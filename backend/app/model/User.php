<?php
namespace app\model;

use think\Model;

class User extends Model
{
    protected $name = 'users';
    protected $autoWriteTimestamp = true;
    protected $createTime = 'created_at';
    protected $updateTime = 'updated_at';
}
