<?php
namespace app\command;

use think\console\Command;
use think\console\Input;
use think\console\Output;
use app\model\Module;
use app\model\Word;

class SeedWords extends Command
{
    protected function configure()
    {
        $this->setName('seed:words')->setDescription('Import JSON word files into database');
    }

    protected function execute(Input $input, Output $output)
    {
        $files = glob('../data/*.json');
        foreach ($files as $file) {
            $name = basename($file, '.json');
            $data = json_decode(file_get_contents($file), true);
            if (!is_array($data)) continue;

            $module = Module::where('name', $name)->find();
            if (!$module) {
                $moduleName = $name;
                $module = Module::create(['name' => $moduleName, 'file_name' => basename($file)]);
            }

            $count = 0;
            foreach ($data as $item) {
                if (empty($item['word']) || empty($item['definition'])) continue;
                Word::create([
                    'module_id' => $module->id,
                    'word' => $item['word'],
                    'definitions' => json_encode($item['definition'], JSON_UNESCAPED_UNICODE),
                ]);
                $count++;
            }
            $output->writeln("Seeded: {$module->name} (" . $count . " words)");
        }
    }
}
