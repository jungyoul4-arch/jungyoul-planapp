<?php
/**
 * 정율사관학원 DB API 프록시
 * 
 * 이 파일을 jungyoul.com 서버의 웹 접근 가능한 경로에 배치하세요.
 * 예: https://jungyoul.com/api/jysk-api.php
 * 
 * 사용법:
 *   GET ?action=get_user&user_id=1234
 *   GET ?action=get_mentor_students&user_id=5678
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// DB 연결
$db_host = 'localhost';
$db_name = 'jysk';
$db_user = 'jysk';
$db_pass = 'jysk';

// 간단한 API 키 검증 (보안)
$api_key = isset($_GET['key']) ? $_GET['key'] : '';
if ($api_key !== 'jysk-planner-2026') {
    echo json_encode(['error' => 'Invalid API key'], JSON_UNESCAPED_UNICODE);
    http_response_code(403);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['error' => 'DB connection failed'], JSON_UNESCAPED_UNICODE);
    http_response_code(500);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {

    // 사용자 정보 조회
    case 'get_user':
        $user_id = intval($_GET['user_id'] ?? 0);
        if ($user_id <= 0) {
            echo json_encode(['error' => 'Invalid user_id']);
            break;
        }
        $stmt = $pdo->prepare('SELECT user_id, kind, name, phone, active_flag FROM User WHERE user_id = ?');
        $stmt->execute([$user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) {
            echo json_encode(['error' => 'User not found']);
            http_response_code(404);
        } else {
            echo json_encode(['success' => true, 'user' => $user], JSON_UNESCAPED_UNICODE);
        }
        break;

    // 멘토(선생)가 관리하는 학생 목록 조회
    // 로직: 멘토의 user_id가 속한 ClassMember의 class_id를 모두 찾아
    //       해당 class_id에 속하는 kind=2이고 active_flag=1인 학생들의 합집합
    case 'get_mentor_students':
        $mentor_id = intval($_GET['user_id'] ?? 0);
        if ($mentor_id <= 0) {
            echo json_encode(['error' => 'Invalid user_id']);
            break;
        }
        $stmt = $pdo->prepare('
            SELECT DISTINCT u.user_id, u.name, u.phone, u.active_flag, c.class_id, c.class_name
            FROM User u
            JOIN ClassMember cm ON u.user_id = cm.user_id
            JOIN Class c ON cm.class_id = c.class_id
            WHERE cm.class_id IN (
                SELECT cm3.class_id FROM ClassMember cm3
                JOIN Class c3 ON cm3.class_id = c3.class_id
                WHERE cm3.user_id = ? AND c3.is_active = 1 AND cm3.active_flag = 1
            )
            AND u.kind = 2
            AND u.active_flag = 1
            AND cm.active_flag = 1
            AND c.is_active = 1
            ORDER BY c.class_name, u.name
        ');
        $stmt->execute([$mentor_id]);
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 반별로 그룹핑
        $classes = [];
        foreach ($students as $s) {
            $cid = $s['class_id'];
            if (!isset($classes[$cid])) {
                $classes[$cid] = [
                    'class_id' => $cid,
                    'class_name' => $s['class_name'],
                    'students' => []
                ];
            }
            $classes[$cid]['students'][] = [
                'user_id' => $s['user_id'],
                'name' => $s['name'],
                'phone' => $s['phone'],
            ];
        }
        
        echo json_encode([
            'success' => true,
            'mentor_id' => $mentor_id,
            'total_students' => count($students),
            'classes' => array_values($classes)
        ], JSON_UNESCAPED_UNICODE);
        break;

    // 특정 반의 학생 목록
    case 'get_class_students':
        $class_id = intval($_GET['class_id'] ?? 0);
        if ($class_id <= 0) {
            echo json_encode(['error' => 'Invalid class_id']);
            break;
        }
        $stmt = $pdo->prepare('
            SELECT u.user_id, u.kind, u.name, u.phone, u.active_flag
            FROM User u
            JOIN ClassMember cm ON u.user_id = cm.user_id
            JOIN Class c ON cm.class_id = c.class_id
            WHERE cm.class_id = ? AND u.active_flag = 1 AND cm.active_flag = 1 AND c.is_active = 1
            ORDER BY u.kind, u.name
        ');
        $stmt->execute([$class_id]);
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'members' => $members], JSON_UNESCAPED_UNICODE);
        break;

    // 릴레이단어장: 사용자(멘토 또는 학생)의 영어(genre_id=3) 클래스 중 멤버 16명 이상인 클래스 목록
    case 'get_relay_classes':
        $user_id = intval($_GET['user_id'] ?? 0);
        if ($user_id <= 0) {
            echo json_encode(['error' => 'Invalid user_id']);
            break;
        }
        $stmt = $pdo->prepare('
            SELECT c.class_id, c.class_name, c.genre_id,
                   (SELECT COUNT(*) FROM ClassMember cm2 WHERE cm2.class_id = c.class_id AND cm2.active_flag = 1) as member_count
            FROM Class c
            JOIN ClassMember cm ON c.class_id = cm.class_id
            WHERE cm.user_id = ?
              AND cm.active_flag = 1
              AND c.genre_id = 3
              AND c.is_active = 1
            HAVING member_count >= 16
            ORDER BY c.class_name
        ');
        $stmt->execute([$user_id]);
        $classes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'classes' => $classes], JSON_UNESCAPED_UNICODE);
        break;

    // 릴레이단어장: 특정 클래스의 학생 목록 (active_flag=1, kind=2)
    case 'get_relay_class_students':
        $class_id = intval($_GET['class_id'] ?? 0);
        if ($class_id <= 0) {
            echo json_encode(['error' => 'Invalid class_id']);
            break;
        }
        $stmt = $pdo->prepare('
            SELECT u.user_id, u.name
            FROM User u
            JOIN ClassMember cm ON u.user_id = cm.user_id
            JOIN Class c ON cm.class_id = c.class_id
            WHERE cm.class_id = ? AND u.kind = 2 AND u.active_flag = 1 AND cm.active_flag = 1 AND c.is_active = 1
            ORDER BY u.name
        ');
        $stmt->execute([$class_id]);
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'students' => $students], JSON_UNESCAPED_UNICODE);
        break;

    default:
        echo json_encode(['error' => 'Unknown action. Available: get_user, get_mentor_students, get_class_students, get_relay_classes, get_relay_class_students']);
        http_response_code(400);
}
?>
