<?php
ob_start();

// Strict error reporting to logs only
error_reporting(E_ALL);
ini_set('display_errors', '0');

// Global DB error bucket to be surfaced by endpoints (never echo here)
$DB_ERROR = '';

// Only start a session if none exists
if (session_status() == PHP_SESSION_NONE) {
	session_start();
}

if (isset($_GET['userTimezone'])) { // Assuming the timezone is sent via GET
	$timezone = $_GET['userTimezone'];

	// Validate the timezone before using it
	if (in_array($timezone, timezone_identifiers_list())) {
		$_SESSION['userTimezone'] = $timezone; // Save to session
		date_default_timezone_set($timezone); // Set as default timezone
	} else {
		// Invalid timezone, fallback to the server's default
		$timezone = date_default_timezone_get();
		date_default_timezone_set($timezone);
	}
} elseif (isset($_SESSION['userTimezone'])) {
	// If the timezone is already stored in the session, use it
	$timezone = $_SESSION['userTimezone'];
	date_default_timezone_set($timezone);
} else {
	// Fallback to server's default timezone
	$timezone = date_default_timezone_get();
	date_default_timezone_set($timezone);
}
// Environment and domain detection for DB credentials
$__host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : (isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : 'cli');
$__host = strtolower(preg_replace('/:\\d+$/', '', $__host));
$ENV_MODE = 'prod';
if ($__host === 'localhost' || preg_match('/\.(local|test)$/i', $__host)) { $ENV_MODE = 'dev'; }
$ENV_HOST = $__host;
// Resolve DB credentials (env vars take precedence)
$DB_HOST = getenv('DB_HOST'); if ($DB_HOST === false || $DB_HOST === 'liap.ca') { $DB_HOST = ($ENV_MODE === 'dev') ? 'localhost' : 'liap.ca'; }
$DB_NAME = getenv('DB_NAME'); if ($DB_NAME === false || $DB_NAME === 'liapca_loggi') { $DB_NAME = ($ENV_MODE === 'dev') ? 'loggi' : 'liapca_loggi'; }
$DB_USER = getenv('DB_USER'); if ($DB_USER === false || $DB_USER === 'liapca_moo') { $DB_USER = ($ENV_MODE === 'dev') ? 'root' : 'liapca_moo'; }
$DB_PASS = getenv('DB_PASS'); if ($DB_PASS === false) { $DB_PASS = 'HigherLaws101'; }

// MySQLi connection
$con = mysqli_connect($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
// Ensure the connection uses utf8mb4 for full Unicode support
if ($con) {
	if (!$con->set_charset('utf8mb4')) {
		error_log('Failed to set mysqli charset to utf8mb4: ' . $con->error);
		// Fallback
		$con->query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
	}
}


// PDO connection
try {

// Increase memory limit
	ini_set('memory_limit', '4024M'); // Sets memory limit to 1024MB
	$dsn = "mysql:host=" . $DB_HOST . ";dbname=" . $DB_NAME . ";charset=utf8mb4";
	$pdo = new PDO($dsn, $DB_USER, $DB_PASS);
	$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

} catch (PDOException $e) {
	$DB_ERROR = 'PDO connection failed: ' . $e->getMessage();
}

if (mysqli_connect_errno()) {
	$DB_ERROR .= ($DB_ERROR ? ' | ' : '') . ('MySQLi connect failed: ' . mysqli_connect_errno());
}
?>
