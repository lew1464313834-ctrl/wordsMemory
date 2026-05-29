<?php
namespace app\model;

use think\Model;

class UserError extends Model
{
    protected $name = 'user_errors';
    public $timestamps = false;

    public function word()
    {
        return $this->belongsTo(Word::class, 'word_id', 'id');
    }
}
