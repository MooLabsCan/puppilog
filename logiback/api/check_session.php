<?php
// CORS
$allowed_origins = [
    'http://localhost:5173',
    'https://learni.liap.ca',
    'https://mooai.liap.ca',
    'https://liap.ca',
    'https://www.liap.ca'
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }
header('Content-Type: application/json');

// Remote auth (moolabs)
include_once '../config/AccountConfig.php'; // provides $pdo to remote DB
include_once './Account.php';

// Local DB (loggi)
require_once('../config/Database.php');
require_once('../users/Users.php');

try {
    $data = json_decode(file_get_contents('php://input'), true);
    $token = isset($data['token']) ? trim((string)$data['token']) : '';

    if ($token === '') {
        http_response_code(400);
        echo json_encode(['status' => 'invalid_token', 'message' => 'Missing authentication token.']);
        exit;
    }

    // 1) Authenticate against remote service (unchanged)
    $account = new Account($pdo);
    $remote = $account->authUser($token);

    if (!is_array($remote) || !isset($remote['status']) || $remote['status'] !== 'authenticated' || !isset($remote['user'])) {
        // Pass through remote response on failure
        echo json_encode($remote ?: ['status' => 'invalid_token', 'message' => 'Authentication failed.']);
        exit;
    }

    // Extract remote user info
    $rUser = $remote['user'];
    $username = isset($rUser['username']) ? trim((string)$rUser['username']) : '';
    $email    = isset($rUser['email']) ? trim((string)$rUser['email']) : null;
    $lang     = isset($rUser['lang']) ? strtoupper(trim((string)$rUser['lang'])) : 'EN';

    // 2) Ensure local user exists in loggi DB by USERNAME (no token auth check)
    $db = new Database();
    $localPdo = $db->connectPDO();
    Users::ensureUsersTable($localPdo);
    $localUser = null;
    if ($username !== '') {
        $localUser = Users::ensureUserByUsername($localPdo, $username, $email, $lang);
    }

    // Try to count existing litters for this local user id
    $littersCount = 0;
    $localUserId = null;
    if (is_array($localUser) && isset($localUser['id'])) {
        $localUserId = (int)$localUser['id'];
        try {
            $stmt = $localPdo->prepare('SELECT COUNT(*) AS c FROM litter_access WHERE user_id = ?');
            $stmt->execute([$localUserId]);
            $row = $stmt->fetch();
            if ($row && isset($row['c'])) {
                $littersCount = (int)$row['c'];
            }
        } catch (Exception $e) {
            // Tables may not exist yet; keep count at 0
        }
    }

    // 3) Return remote auth result, augmented with local info
    $response = $remote;
    $response['local_user_id'] = $localUserId;
    $response['litters_count'] = $littersCount;

    echo json_encode($response, JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}