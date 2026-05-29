<?php
namespace app\model;

use think\Model;

class Module extends Model
{
    protected $name = 'modules';
    protected $autoWriteTimestamp = true;
    protected $createTime = 'created_at';
    protected $updateTime = false;

    public function words()
    {
        return $this->hasMany(Word::class, 'module_id', 'id');
    }
}
