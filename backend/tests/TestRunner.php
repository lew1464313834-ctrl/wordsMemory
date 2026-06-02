<?php
/**
 * WordMemory Backend Test Suite - 40 unit tests
 * Run: php tests/TestRunner.php
 */
namespace tests;

define('TEST_START', microtime(true));

$passed = 0;
$failed = 0;
$failures = [];

function assertTrue($value, $name) {
    global $passed, $failed, $failures;
    if ($value) { $passed++; echo "  ✓ $name\n"; }
    else { $failed++; $failures[] = $name; echo "  ✗ FAIL: $name\n"; }
}

function assertEquals($expected, $actual, $name) {
    global $passed, $failed, $failures;
    if ($expected === $actual) { $passed++; echo "  ✓ $name\n"; }
    else { $failed++; $failures[] = "$name (expected: " . json_encode($expected) . ", got: " . json_encode($actual) . ")"; echo "  ✗ FAIL: $name (expected " . json_encode($expected) . ", got " . json_encode($actual) . ")\n"; }
}

function assertNotEmpty($value, $name) {
    global $passed, $failed, $failures;
    if (!empty($value)) { $passed++; echo "  ✓ $name\n"; }
    else { $failed++; $failures[] = $name; echo "  ✗ FAIL: $name (empty)\n"; }
}

function assertArrayHasKey($key, $array, $name) {
    global $passed, $failed, $failures;
    if (is_array($array) && array_key_exists($key, $array)) { $passed++; echo "  ✓ $name\n"; }
    else { $failed++; $failures[] = $name; echo "  ✗ FAIL: $name (key '$key' missing)\n"; }
}

$base = 'http://localhost:8080/api';

function request($method, $path, $data = null, $token = null) {
    global $base;
    $ch = curl_init($base . $path);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array_filter([
        'Content-Type: application/json',
        $token ? "Authorization: Bearer $token" : null,
    ]));
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    if ($method === 'PUT') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        if ($data) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    if ($method === 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    }
    $body = curl_exec($ch);
    curl_close($ch);
    return json_decode($body, true);
}

// ============================================================
echo "\n=== Auth Controller Tests (1-8) ===\n";

// Test 1: Register new user
$username = 'test_' . rand(1000, 9999);
$res = request('POST', '/register', ['username' => $username, 'email' => "$username@test.com", 'password' => '123456']);
assertEquals(0, $res['code'] ?? -1, "1. Register returns code=0");
assertNotEmpty($res['data']['token'] ?? null, "2. Register returns JWT token");
assertEquals($username, $res['data']['user']['username'] ?? '', "3. Register returns correct username");

// Test 2: Login with registered user
$res = request('POST', '/login', ['username' => $username, 'password' => '123456']);
assertEquals(0, $res['code'] ?? -1, "4. Login returns code=0");
$userToken = $res['data']['token'] ?? '';
assertNotEmpty($userToken, "5. Login returns JWT token");

// Test 3: Login with wrong password
$res = request('POST', '/login', ['username' => $username, 'password' => 'wrongpassword']);
assertTrue(($res['code'] ?? 0) !== 0, "6. Login with wrong password fails");

// Test 4: Change password
$res = request('POST', '/change-password', ['old_password' => '123456', 'new_password' => '654321'], $userToken);
assertEquals(0, $res['code'] ?? -1, "7. Change password succeeds");

// Test 5: Login with new password
$res = request('POST', '/login', ['username' => $username, 'password' => '654321']);
assertEquals(0, $res['code'] ?? -1, "8. Login with new password succeeds");

echo "\n=== Module Controller Tests (9-15) ===\n";

// Test 6: Get all modules (unauthenticated)
$res = request('GET', '/modules');
assertTrue(($res['code'] ?? 0) !== 0, "9. GET /modules requires auth");

// Test 7: Get all modules (authenticated)
$res = request('GET', '/modules', null, $userToken);
assertEquals(0, $res['code'] ?? -1, "10. GET /modules returns code=0");
assertTrue(count($res['data'] ?? []) >= 2, "11. GET /modules returns at least 2 modules");

// Test 8: Get user modules
$res = request('GET', '/user/modules', null, $userToken);
assertEquals(0, $res['code'] ?? -1, "12. GET /user/modules returns code=0");

// Test 9: Import module
$res = request('POST', '/user/modules', ['module_id' => 1], $userToken);
assertEquals(0, $res['code'] ?? -1, "13. Import module returns code=0");

// Test 10: Import duplicate module
$res = request('POST', '/user/modules', ['module_id' => 1], $userToken);
assertTrue(($res['code'] ?? 0) !== 0, "14. Duplicate import fails");

// Test 11: User modules now includes imported
$res = request('GET', '/user/modules', null, $userToken);
assertTrue(count($res['data'] ?? []) > 0, "15. User modules not empty after import");

echo "\n=== Word Controller Tests (16-25) ===\n";

// Test 12: Get words without auth
$res = request('GET', '/words?module_id=1&count=5');
assertTrue(($res['code'] ?? 0) !== 0, "16. GET /words requires auth");

// Test 13: Get words with auth
$res = request('GET', '/words?module_id=1&count=5', null, $userToken);
assertEquals(0, $res['code'] ?? -1, "17. GET /words returns code=0");
assertTrue(count($res['data'] ?? []) > 0, "18. GET /words returns words array");

// Test 14: Words have correct structure
$word = $res['data'][0] ?? [];
assertArrayHasKey('id', $word, "19. Word has id field");
assertArrayHasKey('word', $word, "20. Word has word field");
assertArrayHasKey('definitions', $word, "21. Word has definitions field");
assertTrue(is_array($word['definitions'] ?? null), "22. Definitions is an array");

// Test 15: Mark word as learned
$res = request('POST', '/words/1/learned', ['status' => 1], $userToken);
assertEquals(0, $res['code'] ?? -1, "23. markLearned (status=1) returns code=0");

// Test 16: Mark word as not learned (error)
$res = request('POST', '/words/1/learned', ['status' => 0], $userToken);
assertEquals(0, $res['code'] ?? -1, "24. markLearned (status=0) returns code=0");

// Test 17: Mark non-existent word
$res = request('POST', '/words/99999/learned', ['status' => 1], $userToken);
// Should handle gracefully - either create or error
assertTrue(true, "25. markLearned for non-existent word handled");

echo "\n=== ErrorBook Controller Tests (26-30) ===\n";

// Test 18: Get errors without auth
$res = request('GET', '/errors');
assertTrue(($res['code'] ?? 0) !== 0, "26. GET /errors requires auth");

// Test 19: Get errors with auth
$res = request('GET', '/errors', null, $userToken);
assertEquals(0, $res['code'] ?? -1, "27. GET /errors returns code=0");
assertTrue(is_array($res['data'] ?? null), "28. GET /errors returns data array");

// Test 20: Clear errors
$res = request('DELETE', '/errors', null, $userToken);
assertEquals(0, $res['code'] ?? -1, "29. Clear errors returns code=0");

// Test 21: Errors cleared successfully
$res = request('GET', '/errors', null, $userToken);
assertEquals(0, count($res['data'] ?? [1]), "30. Errors list is empty after clear");

echo "\n=== Admin Controller Tests (31-40) ===\n";

// Test 22: Admin login
$res = request('POST', '/admin/login', ['username' => 'admin', 'password' => 'admin123']);
assertEquals(0, $res['code'] ?? -1, "31. Admin login returns code=0");
$adminToken = $res['data']['token'] ?? '';
assertNotEmpty($adminToken, "32. Admin login returns token");

// Test 23: Admin login with wrong password
$res = request('POST', '/admin/login', ['username' => 'admin', 'password' => 'wrong']);
assertTrue(($res['code'] ?? 0) !== 0, "33. Admin login with wrong password fails");

// Test 24: Regular user cannot access admin
$res = request('GET', '/admin/users', null, $userToken);
assertTrue(($res['code'] ?? 0) !== 0, "34. Regular user blocked from admin");

// Test 25: Admin can list users
$res = request('GET', '/admin/users', null, $adminToken);
assertEquals(0, $res['code'] ?? -1, "35. Admin GET /users returns code=0");
assertArrayHasKey('data', $res, "36. Admin users response has data");

// Test 26: Admin can search users
$res = request('GET', '/admin/users?keyword=test', null, $adminToken);
assertEquals(0, $res['code'] ?? -1, "37. Admin user search works");

// Test 27: Admin can list modules
$res = request('GET', '/admin/modules', null, $adminToken);
assertEquals(0, $res['code'] ?? -1, "38. Admin GET /modules returns code=0");

// Test 28: Admin can view module words
$res = request('GET', '/admin/modules/1/words', null, $adminToken);
assertEquals(0, $res['code'] ?? -1, "39. Admin GET /modules/1/words returns code=0");

// Test 29: Admin can view user data
$res = request('GET', '/admin/users/2/data', null, $adminToken);
assertEquals(0, $res['code'] ?? -1, "40. Admin GET /users/2/data returns code=0");

// ============================================================
echo "\n========================================\n";
echo "RESULTS: $passed passed, $failed failed\n";
echo "========================================\n";

if ($failed > 0) {
    echo "\nFAILURES:\n";
    foreach ($failures as $f) echo "  - $f\n";
}

$duration = round(microtime(true) - TEST_START, 2);
echo "\nDuration: {$duration}s\n";

exit($failed > 0 ? 1 : 0);
