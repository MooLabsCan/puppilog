<?php
/**
 * Local users table management for the loggi database.
 * Uses Database.php (PDO) connection passed in by caller.
 */
class Users
{
    /**
     * Ensure the local users table exists in the loggi database.
     * Columns: id, username, email, display_lang, created_at
     * NOTE: No auth tokens are stored locally; username is the unique key.
     */
    public static function ensureUsersTable($pdo)
    {
        if (!$pdo) return;
        $sql = "CREATE TABLE IF NOT EXISTS users (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            username VARCHAR(100) NOT NULL,
            email VARCHAR(255) NULL,
            display_lang VARCHAR(8) NOT NULL DEFAULT 'EN',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        try {
            $pdo->exec($sql);
        } catch (Exception $e) {
            // Don't block if table creation fails
        }
    }

    /**
     * Find a local user by username.
     * Returns associative array with id, username, email, display_lang or null.
     */
    public static function findUserByUsername($pdo, $username)
    {
        if (!$pdo) return null;
        $uname = trim((string)$username);
        if ($uname === '') return null;
        try {
            $stmt = $pdo->prepare("SELECT id, username, email, display_lang FROM users WHERE username = ? LIMIT 1");
            $stmt->execute([$uname]);
            $row = $stmt->fetch();
            return $row ? $row : null;
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Ensure a user exists by username; if not, insert a new row.
     * Returns the user row (with id, username, email, display_lang) or null on failure.
     */
    public static function ensureUserByUsername($pdo, $username, $email = null, $lang = 'EN')
    {
        if (!$pdo) return null;
        $uname = trim((string)$username);
        if ($uname === '') return null;
        try {
            $existing = self::findUserByUsername($pdo, $uname);
            if ($existing) return $existing;

            $email = $email ? trim((string)$email) : null;
            $lang = strtoupper(trim((string)$lang ?: 'EN'));
            $ins = $pdo->prepare("INSERT INTO users (username, email, display_lang) VALUES (?, ?, ?)");
            $ins->execute([$uname, $email, $lang]);
            $id = (int)$pdo->lastInsertId();
            return [
                'id' => $id,
                'username' => $uname,
                'email' => $email,
                'display_lang' => $lang,
            ];
        } catch (Exception $e) {
            return null;
        }
    }
}
