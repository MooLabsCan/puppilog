<?php
// Same-origin JSON API (no CORS needed)
header('Content-Type: application/json');

require_once('../config/Database.php');

function ensureDataTables($pdo) {
    if (!$pdo) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS puppy_litter (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            owner_user_id INT UNSIGNED NOT NULL DEFAULT 0,
            data LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_owner (owner_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $pdo->exec("CREATE TABLE IF NOT EXISTS puppy (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            litter_id INT UNSIGNED NOT NULL,
            data LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_litter (litter_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

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
    } catch (Exception $e) { }
}

try {
    // No auth: everyone can read all litters
    $db = new Database();
    $pdo = $db->connectPDO();

    ensureDataTables($pdo);

    // Select all litters
    $sql = 'SELECT id, data, created_at, updated_at FROM puppy_litter ORDER BY id DESC';
    $q = $pdo->query($sql);

    $items = [];
    while ($row = $q->fetch(PDO::FETCH_ASSOC)) {
        $data = json_decode($row['data'], true);
        if (!is_array($data)) $data = [];
        $litterId = (int)$row['id'];
        $data['id'] = $litterId;
        if (!isset($data['createdAt'])) $data['createdAt'] = $row['created_at'];
        $data['updatedAt'] = $row['updated_at'];

        // One-time migration: if litter JSON still contains embedded puppies, extract them to puppy table
        if (isset($data['puppies']) && is_array($data['puppies']) && count($data['puppies']) > 0) {
            $embedded = $data['puppies'];
            foreach ($embedded as $p) {
                if (!is_array($p)) continue;
                $pid = isset($p['id']) ? (int)$p['id'] : 0;
                $weightLog = isset($p['weightLog']) && is_array($p['weightLog']) ? $p['weightLog'] : [];
                $pStore = $p; unset($pStore['weightLog']);
                if ($pid > 0) {
                    $updP = $pdo->prepare('UPDATE puppy SET data = ? WHERE id = ? AND litter_id = ?');
                    $updP->execute([ json_encode($pStore, JSON_UNESCAPED_UNICODE), $pid, $litterId ]);
                } else {
                    $insP = $pdo->prepare('INSERT INTO puppy (litter_id, data) VALUES (?, ?)');
                    $insP->execute([ $litterId, json_encode($pStore, JSON_UNESCAPED_UNICODE) ]);
                    $pid = (int)$pdo->lastInsertId();
                }
                // Sync logs
                $delLogs = $pdo->prepare('DELETE FROM puppy_daily_log WHERE puppy_id = ?');
                $delLogs->execute([$pid]);
                if (!empty($weightLog)) {
                    $insLog = $pdo->prepare('INSERT INTO puppy_daily_log (puppy_id, logged_at, weight_grams) VALUES (?, ?, ?)');
                    foreach ($weightLog as $row2) {
                        if (!is_array($row2)) continue;
                        $date = isset($row2['date']) ? $row2['date'] : null;
                        $kg = isset($row2['kg']) ? $row2['kg'] : null;
                        if (!$date) continue;
                        if ($kg === '' || $kg === null) continue;
                        $grams = (int)round(((float)$kg) * 1000);
                        $insLog->execute([$pid, $date.' 00:00:00', $grams]);
                    }
                }
            }
            // Remove puppies from litter JSON and persist updated core data
            unset($data['puppies']);
            $updCore = $pdo->prepare('UPDATE puppy_litter SET data = ? WHERE id = ?');
            $updCore->execute([ json_encode($data, JSON_UNESCAPED_UNICODE), $litterId ]);
        }

        // Attach puppies for this litter
        $puppies = [];
        $qp = $pdo->prepare('SELECT id, data FROM puppy WHERE litter_id = ? ORDER BY id ASC');
        $qp->execute([$litterId]);
        while ($prow = $qp->fetch(PDO::FETCH_ASSOC)) {
            $p = json_decode($prow['data'], true);
            if (!is_array($p)) $p = [];
            $pid = (int)$prow['id'];
            $p['id'] = $pid;
            // Load daily logs and map to weightLog
            $logs = [];
            $ql = $pdo->prepare('SELECT logged_at, weight_grams FROM puppy_daily_log WHERE puppy_id = ? ORDER BY logged_at ASC');
            $ql->execute([$pid]);
            while ($l = $ql->fetch(PDO::FETCH_ASSOC)) {
                $date = substr($l['logged_at'], 0, 10);
                $kg = $l['weight_grams'] !== null ? round(((int)$l['weight_grams']) / 1000, 3) : null;
                $logs[] = [ 'date' => $date, 'kg' => $kg ];
            }
            if (!empty($logs)) {
                $p['weightLog'] = $logs;
            }
            $puppies[] = $p;
        }
        $data['puppies'] = $puppies;

        $items[] = $data;
    }

    echo json_encode(['status' => 'ok', 'items' => $items], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
