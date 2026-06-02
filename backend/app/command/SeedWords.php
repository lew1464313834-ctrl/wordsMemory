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
        // Build file -> display-name map from modules.json
        $nameMap = [];
        $modulesJsonPath = '../data/modules.json';
        if (file_exists($modulesJsonPath)) {
            $modulesData = json_decode(file_get_contents($modulesJsonPath), true);
            if (is_array($modulesData)) {
                foreach ($modulesData as $m) {
                    if (!empty($m['file']) && !empty($m['name'])) {
                        $nameMap[$m['file']] = $m['name'];
                    }
                }
            }
        }

        $files = glob('../data/*.json');
        foreach ($files as $file) {
            $fileName = basename($file);
            // Skip modules.json itself
            if ($fileName === 'modules.json') continue;

            $name = basename($file, '.json');
            $data = json_decode(file_get_contents($file), true);
            if (!is_array($data)) continue;

            $module = Module::where('name', $name)->find();
            if (!$module) {
                // Use display name from modules.json, fallback to filename
                $moduleName = $nameMap[$fileName] ?? $name;
                $module = Module::create(['name' => $moduleName, 'file_name' => $fileName]);
            }

            $count = 0;
            foreach ($data as $item) {
                if (empty($item['word']) || empty($item['definition'])) continue;
                Word::create([
                    'module_id'   => $module->id,
                    'word'        => $item['word'],
                    'phonetic'    => $item['Phonetic'] ?? null,
                    'definitions' => json_encode($item['definition'], JSON_UNESCAPED_UNICODE),
                ]);
                $count++;
            }
            $output->writeln("Seeded: {$module->name} (" . $count . " words)");
        }
    }
}
