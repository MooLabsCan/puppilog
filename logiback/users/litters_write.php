<?php
// Same-origin JSON API (no CORS needed)
header('Content-Type: application/json');

require_once('../config/Database.php');

function ensureDataTables($pdo) {
    if (!$pdo) return;
    try {
        // Litter stored as JSON (without heavy puppy content)
        $pdo->exec("CREATE TABLE IF NOT EXISTS puppy_litter (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            owner_user_id INT UNSIGNED NOT NULL DEFAULT 0,
            data LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_owner (owner_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Puppy table (per-puppy data stored as JSON, linked to litter)
        $pdo->exec("CREATE TABLE IF NOT EXISTS puppy (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            litter_id INT UNSIGNED NOT NULL,
            data LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_litter (litter_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Daily log for each puppy
        $pdo->exec("CREATE TABLE IF NOT EXISTS puppy_daily_log (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            puppy_id INT UNSIGNED NOT NULL,
            logged_at DATETIME NOT NULL,
            weight_grams INT NULL,
            notes TEXT NULL,
            photos LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_puppy (puppy_id),
            INDEX idx_logged (logged_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (Exception $e) {
        // ignore schema errors in runtime
    }
}

try {
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $litter = isset($payload['litter']) ? $payload['litter'] : null;

    if (!$litter) {
        http_response_code(400);
        echo json_encode(['status' => 'bad_request', 'message' => 'Missing litter']);
        exit;
    }

    $db = new Database();
    $pdo = $db->connectPDO();

    ensureDataTables($pdo);

    // Normalize litter structure and timestamps
    $nowIso = gmdate('c');
    if (!isset($litter['createdAt']) || !$litter['createdAt']) { $litter['createdAt'] = $nowIso; }
    $litter['updatedAt'] = $nowIso;

    // Extract puppies from litter to store separately
    $puppies = [];
    if (isset($litter['puppies']) && is_array($litter['puppies'])) {
        $puppies = $litter['puppies'];
        unset($litter['puppies']); // keep litter data lean in DB
    }

    // Save litter core JSON first
    $jsonCore = json_encode($litter, JSON_UNESCAPED_UNICODE);

    // Insert new or update existing
    $litterId = isset($litter['id']) ? (int)$litter['id'] : 0;
    if ($litterId > 0) {
        $upd = $pdo->prepare('UPDATE puppy_litter SET data = ? WHERE id = ?');
        $upd->execute([$jsonCore, $litterId]);
    } else {
        $ins = $pdo->prepare('INSERT INTO puppy_litter (owner_user_id, data) VALUES (0, ?)');
        $ins->execute([$jsonCore]);
        $litterId = (int)$pdo->lastInsertId();
    }

    // Synchronize puppies table and daily logs
    // 1) Determine existing puppies in DB for this litter
    $existingIds = [];
    $stmt = $pdo->prepare('SELECT id FROM puppy WHERE litter_id = ?');
    $stmt->execute([$litterId]);
    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) { $existingIds[] = (int)$r['id']; }

    $incomingIds = [];
    $savedPuppies = [];

    foreach ($puppies as $p) {
        if (!is_array($p)) continue;
        $pid = isset($p['id']) ? (int)$p['id'] : 0;
        // Split weightLog out from puppy core data
        $weightLog = [];
        if (isset($p['weightLog']) && is_array($p['weightLog'])) {
            $weightLog = $p['weightLog'];
        }
        // Prepare puppy data to store (without weightLog)
        $pStore = $p;
        unset($pStore['weightLog']);

        if ($pid > 0) {
            // update existing (ensure belongs to litter)
            $updP = $pdo->prepare('UPDATE puppy SET data = ? WHERE id = ? AND litter_id = ?');
            $updP->execute([ json_encode($pStore, JSON_UNESCAPED_UNICODE), $pid, $litterId ]);
        } else {
            // insert new
            $insP = $pdo->prepare('INSERT INTO puppy (litter_id, data) VALUES (?, ?)');
            $insP->execute([ $litterId, json_encode($pStore, JSON_UNESCAPED_UNICODE) ]);
            $pid = (int)$pdo->lastInsertId();
        }

        // Sync daily weight logs: replace strategy
        $delLogs = $pdo->prepare('DELETE FROM puppy_daily_log WHERE puppy_id = ?');
        $delLogs->execute([$pid]);
        if (!empty($weightLog)) {
            $insLog = $pdo->prepare('INSERT INTO puppy_daily_log (puppy_id, logged_at, weight_grams) VALUES (?, ?, ?)');
            foreach ($weightLog as $row) {
                if (!is_array($row)) continue;
                $date = isset($row['date']) ? $row['date'] : null; // expected YYYY-MM-DD
                $kg = isset($row['kg']) ? $row['kg'] : null;
                if (!$date) continue;
                // only store rows that have a numeric weight
                if ($kg === '' || $kg === null) continue;
                $grams = (int)round(((float)$kg) * 1000);
                $insLog->execute([$pid, $date.' 00:00:00', $grams]);
            }
        }

        // Rebuild puppy payload for response (with id and original weightLog)
        $pOut = $p;
        $pOut['id'] = $pid;
        $pOut['weightLog'] = $weightLog; // keep as provided by client
        $savedPuppies[] = $pOut;
        $incomingIds[] = $pid;
    }

    // 2) Delete puppies that were removed (not present in incoming list)
    $toDelete = array_diff($existingIds, $incomingIds);
    if (!empty($toDelete)) {
        $in = implode(',', array_map('intval', $toDelete));
        // delete logs first, then puppies
        $pdo->exec("DELETE FROM puppy_daily_log WHERE puppy_id IN ($in)");
        $pdo->exec("DELETE FROM puppy WHERE id IN ($in)");
    }

    // Return saved record (attach definitive id and puppies back for the client)
    $litter['id'] = $litterId;
    $litter['puppies'] = $savedPuppies;

    echo json_encode([
        'status' => 'ok',
        'litter' => $litter
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
