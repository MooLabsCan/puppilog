<?php
// Define allowed origins
$allowed_origins = [
    'http://localhost:5173',
    'https://learni.liap.ca',
    'https://mooai.liap.ca',
    'https://liap.ca',
    'https://www.liap.ca'
];


// Get the Origin header from the request
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Check if the origin is allowed
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: " . $origin);
    header("Access-Control-Allow-Headers: Content-Type");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
}

// Only short-circuit OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ---- real request logic below ----
include_once '../config/AccountConfig.php';
include_once './Account.php';
$data = json_decode(file_get_contents("php://input"), true);
$token = $data['token'] ?? null;
$lang = $data['lang'] ?? null;

$functions = new Account($pdo);
$result = $functions->changeLang($token, $lang);

echo json_encode($result);
