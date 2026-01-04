<?php
ob_start();
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

$timezone = date_default_timezone_set("America/Toronto");

// Database configuration
$db_host = "localhost";
$db_user = "root";
$db_pass = "";
$db_name = "moolabs";

// Create mysqli connection (keeping existing code)
$conn = mysqli_connect($db_host, $db_user, $db_pass, $db_name);
// Ensure the connection uses utf8mb4 for full Unicode (e.g., Georgian)
if ($conn) {
    if (!$conn->set_charset('utf8mb4')) {
        error_log('Failed to set mysqli charset to utf8mb4: ' . $conn->error);
        // Fallback
        $conn->query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    }
}

if(mysqli_connect_errno()) {
    echo "Failed to connect: " . mysqli_connect_errno();
}

// Create PDO connection
try {
    $dsn = "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch(PDOException $e) {
    echo "PDO Connection failed: " . $e->getMessage();
}
?>