<?php
namespace app\controller;

use app\model\UserError;
use think\facade\Request;

class ErrorBook
{
    public function index()
    {
        $userId = Request::instance()->userId;
        $sort = Request::param('sort', 'last_error_time');
        $order = Request::param('order', 'desc');

        $data = UserError::where('user_id', $userId)
            ->where('is_cleared', 0)
            ->with('word')
            ->order($sort, $order)
            ->select()
            ->toArray();

        $result = array_map(function ($item) {
            return [
                'word_id' => $item['word']['id'],
                'word' => $item['word']['word'],
                'definitions' => json_decode($item['word']['definitions'], true),
                'module' => $item['word']['module_id'],
                'error_count' => $item['error_count'],
                'last_error_time' => $item['last_error_time'],
            ];
        }, $data);

        return json(['code' => 0, 'data' => $result]);
    }

    public function clear()
    {
        $userId = Request::instance()->userId;
        UserError::where('user_id', $userId)->update(['is_cleared' => 1]);
        return json(['code' => 0, 'msg' => '已清空']);
    }
}
