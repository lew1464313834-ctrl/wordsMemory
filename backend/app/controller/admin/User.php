<?php
namespace app\controller\admin;

use app\model\User as UserModel;
use think\facade\Request;

class User
{
    public function index()
    {
        $keyword = Request::param('keyword', '');
        $page = intval(Request::param('page', 1));
        $query = UserModel::field('id,username,email,role,status,created_at');
        if ($keyword) {
            $query->where('username|email', 'like', "%{$keyword}%");
        }
        $data = $query->order('id desc')->page($page, 20)->select();
        $total = UserModel::count();
        return json(['code' => 0, 'data' => ['list' => $data, 'total' => $total]]);
    }

    public function updateStatus($id)
    {
        $status = Request::param('status', 1);
        UserModel::where('id', $id)->update(['status' => $status]);
        return json(['code' => 0, 'msg' => 'ok']);
    }

    public function delete($id)
    {
        if ($id == 1) return json(['code' => 400, 'msg' => '不能删除超级管理员']);
        UserModel::destroy($id);
        return json(['code' => 0, 'msg' => '已删除']);
    }
}
