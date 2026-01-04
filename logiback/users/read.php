<?php
// Local read endpoint for the loggi database.
// NOTE: This does NOT authenticate users. It only reads local user info by USERNAME,
// and reports how many litters are attached to the local user id.

$allowed_origins = [
    'http://localhost:5173',
    'http://localhost',
    'https://logi.liap.ca',
    'https://mooai.liap.ca',
    'https://liap.ca',
    'https://www.liap.ca'
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }
header('Content-Type: application/json');

require_once('../config/Database.php');

try {
    // Require username from GET/POST
    $username = '';

    if (isset($_GET['une'])) { $username = trim((string)$_GET['une']); }
    if ($username === '' && isset($_GET['username'])) { $username = trim((string)$_GET['username']); }

    if ($username === '') {
        $payload = json_decode(file_get_contents('php://input'), true);
        if ($payload) {
            if (isset($payload['username'])) { $username = trim((string)$payload['username']); }
            if ($username === '' && isset($payload['une'])) { $username = trim((string)$payload['une']); }
        }
    }

    if ($username === '') {
        http_response_code(400);
        echo json_encode(['status' => 'bad_request', 'message' => 'Missing username']);
        exit;
    }

    $db = new Database();
    $pdo = $db->connectPDO();

    // Look up local user by username
    $stmt = $pdo->prepare('SELECT id, username, email, display_lang FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch();

    if ($row) {
        $userId = (int)$row['id'];
        // Count litters attached to this user via litter_access
        $litters = 0;
        try {
            $q = $pdo->prepare('SELECT COUNT(*) AS c FROM litter_access WHERE user_id = ?');
            $q->execute([$userId]);
            $c = $q->fetch();
            if ($c && isset($c['c'])) { $litters = (int)$c['c']; }
        } catch (Exception $e) { /* tables may not exist yet */ }

        echo json_encode([
            'status' => 'ok',
            'user' => [
                'id' => $userId,
                'username' => $row['username'],
                'email' => $row['email'],
                'lang' => strtoupper($row['display_lang'])
            ],
            'litters_count' => $litters
        ], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(404);
        echo json_encode(['status' => 'not_found']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>