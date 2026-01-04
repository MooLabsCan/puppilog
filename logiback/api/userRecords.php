<?php
// Public endpoint: return records grouped by username
header('Content-Type: application/json');
require_once('../config/AccountConfig.php'); // provides $conn (MySQLi)

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['status' => 'fail', 'message' => 'Invalid method']);
        exit;
    }

    if (!isset($conn) || !($conn instanceof mysqli)) {
        http_response_code(500);
        echo json_encode(['status' => 'fail', 'message' => 'DB not available']);
        exit;
    }

    // Inputs
    $username = isset($_GET['username']) ? trim($_GET['username']) : '';
    $limit    = isset($_GET['limit']) ? (int)$_GET['limit'] : 500;
    $offset   = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    if ($limit < 1 || $limit > 500) $limit = 500;
    if ($offset < 0) $offset = 0;

    // SQL
    if ($username !== '') {
        $sql = "SELECT username, site, timestamp 
                  FROM records 
                 WHERE username = ? 
              ORDER BY timestamp DESC 
                 LIMIT ? OFFSET ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('sii', $username, $limit, $offset);
    } else {
        $sql = "SELECT username, site, timestamp 
                  FROM records 
              ORDER BY timestamp DESC 
                 LIMIT ? OFFSET ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $limit, $offset);
    }

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['status' => 'fail', 'message' => 'DB error', 'error' => $conn->error]);
        exit;
    }

    // Execute
    $stmt->execute();
    $stmt->bind_result($resUsername, $site, $timestamp);

    // Group results
    $users = [];
    while ($stmt->fetch()) {
        if (!isset($users[$resUsername])) {
            $users[$resUsername] = [
                'username' => $resUsername,
                'records'  => []
            ];
        }
        $users[$resUsername]['records'][] = [
            'site'      => $site,
            'timestamp' => $timestamp
        ];
    }
    $stmt->close();

    echo json_encode([
        'status' => 'success',
        'count'  => count($users),
        'items'  => array_values($users) // reindex to numeric array
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'fail', 'message' => $e->getMessage()]);
}
