<?php
class Account
{

    private $con;
    private $errorArray;

    public function __construct($conn)
    {
        $this->con = $conn;
        $this->errorArray = array();
    }


    public function authUser($token) {
        // Basic validation
        $token = trim((string)$token);
        if ($token === '') {
            return [
                'status' => 'invalid_token',
                'message' => 'Missing authentication token.',
                'received_token' => $token
            ];
        }

        // Try to find the user by auth token
        $stmt = $this->con->prepare("SELECT id, email, username, display_lang FROM users WHERE auth_token = ?");
        $stmt->execute([$token]);
        $row = $stmt->fetch();

        if ($row) {
            return [
                'status' => 'authenticated',
                'user' => [
                    'id' => (int)$row['id'],
                    'username' => $row['username'],
                    'lang' => strtoupper($row['display_lang']),
                    'email' => $row['email']
                ],
                'received_token' => $token
            ];
        }

        // Not found locally; Account.php no longer provisions users.
        return [
            'status' => 'invalid_token',
            'message' => 'Authentication failed.',
            'received_token' => $token
        ];
    }

    public function changeLang($token, $lang) {
        // Validate language against allowed set
        $allowed = ['EN', 'PT', 'FR'];
        $lang = strtoupper(trim((string)$lang));
        if (!in_array($lang, $allowed, true)) {
            return [
                'status' => 'invalid_lang',
                'message' => 'Language must be one of EN, PT, or FR.',
                'received_token' => $token,
                'received_lang' => $lang
            ];
        }

        // Verify token and update language
        $select = $this->con->prepare("SELECT email, username FROM users WHERE auth_token = ?");
        $select->execute([$token]);
        $row = $select->fetch();

        if (!$row) {
            return [
                'status' => 'invalid_token',
                'message' => 'Authentication failed.',
                'received_token' => $token
            ];
        }

        // Perform the update
        $update = $this->con->prepare("UPDATE users SET display_lang = ? WHERE auth_token = ?");
        $update->execute([$lang, $token]);

        // Fetch updated info to return
        $stmt = $this->con->prepare("SELECT email, username, display_lang FROM users WHERE auth_token = ?");
        $stmt->execute([$token]);
        $updated = $stmt->fetch();

        return [
            'status' => 'updated',
            'user' => [
                'username' => $updated['username'],
                'lang' => strtoupper($updated['display_lang']),
                'email' => $updated['email']
            ],
            'received_token' => $token
        ];
    }


}
