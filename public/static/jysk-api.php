<?php
/**
 * 정율사관학원 API (jysk-api.php)
 * - 고교학점플래너 연동용 REST API
 * - 위치: https://jungyoul.com/api/jysk-api.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 간단한 API 키 체크
$api_key = $_GET['key'] ?? '';
if ($api_key !== 'jysk-planner-2026') {
    echo json_encode(['error' => 'Invalid API key'], JSON_UNESCAPED_UNICODE);
    exit;
}

// DB 연결
try {
    $pdo = new PDO('mysql:host=localhost;dbname=jysk;charset=utf8mb4', 'jysk', 'jysk');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['error' => 'DB connection failed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$action = $_GET['action'] ?? '';

switch ($action) {

    // ==================== 사용자 조회 ====================
    case 'get_user':
        $user_id = $_GET['user_id'] ?? null;
        if (!$user_id) {
            echo json_encode(['error' => 'user_id required'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $stmt = $pdo->prepare('SELECT user_id, kind, name, phone, active_flag FROM User WHERE user_id = ?');
        $stmt->execute([$user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            $user['user_id'] = (int)$user['user_id'];
            $user['kind'] = (int)$user['kind'];
            $user['active_flag'] = (int)$user['active_flag'];
            echo json_encode(['success' => true, 'user' => $user], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(['success' => false, 'error' => 'User not found'], JSON_UNESCAPED_UNICODE);
        }
        break;

    // ==================== 멘토의 학생 목록 (반별) ====================
    case 'get_mentor_students':
        $user_id = $_GET['user_id'] ?? null;
        if (!$user_id) {
            echo json_encode(['error' => 'user_id required'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 멘토가 속한 활성 클래스 목록
        $stmt = $pdo->prepare('
            SELECT c.class_id, c.class_name
            FROM ClassMember cm
            JOIN Class c ON c.class_id = cm.class_id
            WHERE cm.user_id = ? AND cm.active_flag = 1 AND c.is_active = 1
            ORDER BY c.class_name
        ');
        $stmt->execute([$user_id]);
        $classes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $total_students = 0;
        $result_classes = [];

        foreach ($classes as $cls) {
            // 각 클래스의 활성 학생(kind=2) 목록
            $stmt2 = $pdo->prepare('
                SELECT u.user_id, u.name, u.phone
                FROM ClassMember cm
                JOIN User u ON u.user_id = cm.user_id
                WHERE cm.class_id = ? AND cm.active_flag = 1 AND cm.kind = 2 AND u.active_flag = 1
                ORDER BY u.name
            ');
            $stmt2->execute([$cls['class_id']]);
            $students = $stmt2->fetchAll(PDO::FETCH_ASSOC);

            foreach ($students as &$s) {
                $s['user_id'] = (int)$s['user_id'];
            }
            unset($s);

            $total_students += count($students);
            $result_classes[] = [
                'class_id' => (int)$cls['class_id'],
                'class_name' => $cls['class_name'],
                'students' => $students
            ];
        }

        echo json_encode([
            'success' => true,
            'mentor_id' => (int)$user_id,
            'total_students' => $total_students,
            'classes' => $result_classes
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ==================== 클래스 멤버 조회 ====================
    case 'get_class_students':
        $class_id = $_GET['class_id'] ?? null;
        if (!$class_id) {
            echo json_encode(['error' => 'class_id required'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $stmt = $pdo->prepare('
            SELECT u.user_id, cm.kind, u.name, u.phone, u.active_flag
            FROM ClassMember cm
            JOIN User u ON u.user_id = cm.user_id
            WHERE cm.class_id = ? AND cm.active_flag = 1
            ORDER BY cm.kind, u.name
        ');
        $stmt->execute([$class_id]);
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($members as &$m) {
            $m['user_id'] = (int)$m['user_id'];
            $m['kind'] = (int)$m['kind'];
            $m['active_flag'] = (int)$m['active_flag'];
        }
        unset($m);
        echo json_encode(['success' => true, 'members' => $members], JSON_UNESCAPED_UNICODE);
        break;

    // ==================== 학생이 속한 활성 클래스 (아하 리포트 대상만) ====================
    case 'get_student_classes':
        $user_id = $_GET['user_id'] ?? null;
        if (!$user_id) {
            echo json_encode(['error' => 'user_id required'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmt = $pdo->prepare('
            SELECT c.class_id, c.class_name, c.genre_id
            FROM ClassMember cm
            JOIN Class c ON c.class_id = cm.class_id
            WHERE cm.user_id = ? AND cm.kind = 2 AND cm.active_flag = 1
              AND c.is_active = 1 AND c.is_aha_report = 1
            ORDER BY c.class_name
        ');
        $stmt->execute([$user_id]);
        $classes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($classes as &$c) {
            $c['class_id'] = (int)$c['class_id'];
            $c['genre_id'] = (int)$c['genre_id'];
        }
        unset($c);

        echo json_encode(['success' => true, 'classes' => $classes], JSON_UNESCAPED_UNICODE);
        break;

    // ==================== 릴레이단어장: 대상 클래스 목록 ====================
    // 영어(genre_id=3) 클래스 중 학생(kind=2)이 15명 이상인 클래스
    case 'get_relay_classes':
        $user_id = $_GET['user_id'] ?? null;
        if (!$user_id) {
            echo json_encode(['error' => 'user_id required'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmt = $pdo->prepare('
            SELECT c.class_id, c.class_name, c.genre_id,
                   COUNT(cm.user_id) AS member_count
            FROM ClassMember cm
            JOIN Class c ON c.class_id = cm.class_id
            WHERE cm.active_flag = 1
              AND cm.kind = 2
              AND c.genre_id = 3
              AND c.is_active = 1
              AND cm.class_id IN (
                  SELECT class_id FROM ClassMember
                  WHERE user_id = ? AND active_flag = 1
              )
            GROUP BY c.class_id, c.class_name, c.genre_id
            HAVING member_count >= 15
            ORDER BY c.class_name
        ');
        $stmt->execute([$user_id]);
        $classes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($classes as &$c) {
            $c['class_id'] = (int)$c['class_id'];
            $c['genre_id'] = (int)$c['genre_id'];
            $c['member_count'] = (int)$c['member_count'];
        }
        unset($c);

        echo json_encode(['success' => true, 'classes' => $classes], JSON_UNESCAPED_UNICODE);
        break;

    // ==================== 릴레이단어장: 클래스 학생 목록 ====================
    // 해당 클래스의 활성 학생(kind=2)만 반환
    case 'get_relay_class_students':
        $class_id = $_GET['class_id'] ?? null;
        if (!$class_id) {
            echo json_encode(['error' => 'class_id required'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $stmt = $pdo->prepare('
            SELECT u.user_id, u.name
            FROM ClassMember cm
            JOIN User u ON u.user_id = cm.user_id
            WHERE cm.class_id = ? AND cm.active_flag = 1 AND cm.kind = 2 AND u.active_flag = 1
            ORDER BY u.name
        ');
        $stmt->execute([$class_id]);
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($students as &$s) {
            $s['user_id'] = (int)$s['user_id'];
        }
        unset($s);
        echo json_encode(['success' => true, 'students' => $students], JSON_UNESCAPED_UNICODE);
        break;

    // ==================== 알 수 없는 액션 ====================
    default:
        echo json_encode([
            'error' => 'Unknown action. Available: get_user, get_mentor_students, get_class_students, get_student_classes, get_relay_classes, get_relay_class_students'
        ], JSON_UNESCAPED_UNICODE);
        break;
}
