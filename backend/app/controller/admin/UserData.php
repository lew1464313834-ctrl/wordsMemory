<?php
namespace app\controller\admin;

use app\model\UserModule;
use app\model\UserError;
use app\model\UserWord;

class UserData
{
    public function view($userId)
    {
        $modules = UserModule::where('user_id', $userId)->with('module')->select();
        $errorStats = UserError::where('user_id', $userId)->where('is_cleared', 0)->count();
        $learnedCount = UserWord::where('user_id', $userId)->where('status', 1)->count();
        $totalWords = UserWord::where('user_id', $userId)->count();
        return json(['code' => 0, 'data' => [
            'modules' => $modules,
            'error_count' => $errorStats,
            'learned_count' => $learnedCount,
            'total_learned' => $totalWords,
        ]]);
    }
}
