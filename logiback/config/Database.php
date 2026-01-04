<?php
class Database {
    // DB Params
    private $host = 'localhost';
    private $db_name = 'loggi';
    private $username = 'root';
    private $password = '';

    private $pdoConn;
    private $mysqliConn;

    public function __construct() {
        // Timezone setup
        if (session_status() == PHP_SESSION_NONE) {
            session_start();
        }

        if (isset($_GET['userTimezone'])) {
            $tz = $_GET['userTimezone'];
            if (in_array($tz, timezone_identifiers_list())) {
                $_SESSION['userTimezone'] = $tz;
                date_default_timezone_set($tz);
            } else {
                date_default_timezone_set(date_default_timezone_get());
            }
        } elseif (isset($_SESSION['userTimezone'])) {
            date_default_timezone_set($_SESSION['userTimezone']);
        } else {
            date_default_timezone_set(date_default_timezone_get());
        }
    }

    // Connect using PDO (default)
    public function connectPDO() {
        $this->pdoConn = null;

        try {
            $this->pdoConn = new PDO(
                "mysql:host={$this->host};dbname={$this->db_name}",
                $this->username,
                $this->password
            );
            $this->pdoConn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch (PDOException $e) {
            echo 'PDO Connection Error: ' . $e->getMessage();
        }

        return $this->pdoConn;
    }

    // Connect using MySQLi
    public function connectMySQLi() {
        $this->mysqliConn = new mysqli($this->host, $this->username, $this->password, $this->db_name);

        if ($this->mysqliConn->connect_error) {
            die('MySQLi Connection Error: ' . $this->mysqliConn->connect_error);
        }

        return $this->mysqliConn;
    }
}
