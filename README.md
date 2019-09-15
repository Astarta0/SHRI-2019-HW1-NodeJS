# SHRI-2019-HW1-NodeJS

##### Запуск:
    node index.js -p PATH
    
##### Мини-Хелп:
    node index.js -h
    
При запуске проверяется:
- что установлен git
- переданный путь до папки - абсолютный
- это действительно директория, а не файл
- если ее не существует - создается

Что использовалось:
- [ExpressJS](https://expressjs.com)
- [yargs](https://github.com/yargs/yargs) - для разбора параметров, переданных в командной строке при запуске; для предобработки и составления help;
- [rimraf](https://www.npmjs.com/package/rimraf) - для рекурсивного удаления директорий с содержимым
- [junk](https://www.npmjs.com/package/junk) - отфильтровывает скрытые файлы
- [body-parser](https://www.npmjs.com/package/body-parser) - чтобы разбирать параметры в request body
- [Prettier](https://prettier.io) - выравнивание код-стайла

- [x] При клонировании репозитория в команду добавлен параметр GIT_TERMINAL_PROMPT=0,
как советовали [тут](https://serverfault.com/a/665959), чтобы не было ожидания пользовательского ввода при попытке склонировать несуществующий репозиторий.
Но на практике мне эту проблему не удалось воспроизвести.

- [x] Так же, хоть мы условно и приняли считать главной ветку master, я получаю имя ветки командой в методе defineMainBranchName из gitUtils.js

- [x] При запросе содержимого папки в репозитории(в ветке или по хешу, или в главной ветке), если передать путь, которого не существует, 
в ответ вернется json вида `{ "content": [] }`. Я решила пока оставить так, но можно так же вернуть и 404 ошибку.

- [x] Добавлен роут для пагинации по массиву коммитов. Старый, запрашивающий все коммиты, закомментирован в коде.
Они используют разные git команды для получения коммитов, но с одинаковым форматом вывода.
Переход по страницам с помощью параметров limit и offset, т.е. запрос следующего вида:
`GET http://localhost:3000/api/repos/SHRI-2019-Task1/commits/master?limit=5&offset=7`


:snail: TODO:
- реализовать очередь для роутов, где надо делать пулл или чекаут, или выполняется смена рабочей директории, для получения актуального содержания - это может привести к ошибкам при выполнении разных асинхронных запросов

Решила добавить --git-dir параметр в команды гита для минимизации перехода в папки (смена рабочего каталога), чтобы избежать ошибок race condition запросов

:scream: Но при таком подходе получились проблемы в роутах, где используются стримы:

    1. Роут для получения diff: если не переходить в директорию и использовать git-dir в команде для получения
       данных - получаю ошибку `"error: Could not access '4b825dc642cb6eb9a060e54bf8d69288fbee4904'\n"`. Хотя при тестировании руками - все ок.

    2. Poут для получения бинарного содержимого файла:
    при использовании --git-dir ошибка
    {"error": "fatal: not a git repository: ''/Users/astarta0/repos/differentBranchesRepository/.git''\n"}
    При тестировании руками тоже ок - выводит файл.
:exclamation: Итого, в этих роутах выполняется переход в папку репозитория, и команды, результат которых идет в стрим, выполняются как и в первой версии - без параметра --git-dir.  В коде оставлены закомментированные строки.



---------------------------
# Само задание:
    Реализовать сервер на Node.js, который предоставляет клиенту API для работы с git репозиториями.
#### Условия:
* путь до папки с репозиториями передается как аргумент командной строки
* сервер на Express
* для работы с git использовать готовые библиотеки нельзя
_commitHash == branchName_

#### API состоит из следующих HTTP-запросов:
- ```GET /api/repos```
Возвращает массив репозиториев, которые имеются в папке.

- ```GET /api/repos/:repositoryId/commits/:commitHash```

Возвращает массив коммитов в данной ветке (или хэше коммита) вместе с датами их создания и названием.

- ```GET /api/repos/:repositoryId/commits/:commitHash/diff```
Возвращает diff коммита в виде строки.

- ```GET /api/repos/:repositoryId(/tree/:commitHash/:path)```

Возвращает содержимое репозитория по названию ветки (или хэшу комита). Параметр repositoryId - название репозитория (оно же - имя папки репозитория). То, что в скобках - опционально, если отсутствует и branchName, и path - отдать актуальное содержимое в корне в главной ветке репозитория.

    Примеры:
        /api/repos/cool-timer
        /api/repos/cool-timer/tree/cool-branch/src/components
        /api/repos/cool-timer/tree/master/src/components
        /api/repos/cool-timer/tree/e1r2r32b321bdad2e1knbh231/src/components
        
- ```GET /api/repos/:repositoryId/blob/:commitHash/:pathToFile```

Возвращает содержимое конкретного файла, находящегося по пути pathToFile в ветке (или по хэшу коммита) branchName. С используемой памятью должно быть все в порядке.

    Примеры:
        /api/repos/cool-timer/blob/cool-branch/src/components/Header/index.tsx
        
- ```DELETE /api/repos/:repositoryId```
Безвозвратно удаляет репозиторий

- ```POST /api/repos + { url: ‘repo-url’ }```

Добавляет репозиторий в список, скачивает его по переданной в теле запроса ссылке и добавляет в папку со всеми репозиториями.

*Бонус*
Сделать пагинацию для списка коммитов (формат запроса придумать самим)

*Супер Бонус*
Реализовать HTTP-запрос для подсчета символов в репозитории, возвращает объект, в котором ключ - это символ, а значение - количество таких символов в репозитории. Во время запроса, сервер должен работать - то есть отвечать на другие запросы.
