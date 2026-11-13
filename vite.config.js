import { defineConfig } from 'vite'

// Импорт Nunjucks
import nunjucks from 'vite-plugin-nunjucks'

// Импорт модулей для генерации массива страниц
import { glob } from 'glob'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Импорт модуля для обновления страницы в браузере (используется только для файлов "*.njk", но это можно настроить)
import FullReload from 'vite-plugin-full-reload'

// Импорт модуля для минификации html кода при prod-сборке 
import htmlMinifier from 'vite-plugin-html-minifier'


// Генерация объекта со всеми страницами проекта в виде { 'имя/страницы': '/полный/путь/к/файлу.html', ... }
const get_pages = () => {
    let root_path = "./app/**/*.html"; // назначаем корневую директорию проекта

    var pages = Object.fromEntries(
        glob.sync(root_path, {
            ignore: [
                "./app/**/cmp/**/*.html", // игнорируем компоненты
            ]
        }).map(file => [
            path.relative(
                "./app",
                file.slice(0, file.length - path.extname(file).length)
            ),
            fileURLToPath(new URL(file, import.meta.url))
        ]
    ));

    console.log("detected pages:");
    console.log(pages);
    console.log();

    return pages
}


// Фильтры
// const formatMoney = (val) => { // полуает int(1234567), возвращает str(1 234 567)
//     let result = ""
//     let v = val.toString()
//     for (let i = 0; i < v.length; i++) {
//         if (i % 3 === 0 && i !== 0)
//             result = `${v[v.length-1 - i]} ` + result
//         else
//             result = v[v.length-1 - i] + result
//     }

//     return result
// }


export default defineConfig((command) => {
    const global = {
        // web root - "./web/app/"
        // mobile root - "./mobile/app/"
        root: "./app/", // назначаем корневую директорию проекта

        base: '/tulahack2026-uno/', // публичный базовый путь для корректной работы на GitHub Pages

        clearScreen: false, // отключаем очистку консоли при запуске сервера
    }

    // настройки для dev сервера
    const server = {
        open: true, // при запуске открываем страницу в браузере
        host: true, // создаём хост для подключения из локальной сети
        // web port - 8080
        // mobile port - 8082
        port: 8080,
        strictPort: true,
        watch: {
            usePolling: true
        }
    }

    // настройки для preview сервера
    const preview = {
        open: true, // при запуске открываем страницу в браузере
        host: true, // создаём хост для подключения из локальной сети
        // web port - 8080
        // mobile port - 8082
        port: 8081,
    }

    // настройки для сборщика
    const build = {
        cssCodeSplit: false, // отключаем разделение стилей по разным файлам

        outDir: "../dist", // задаём папку для сборки
        emptyOutDir: "../dist", // задаём папку, которую перед сборкой нужно очищать

        rollupOptions: {
            input: get_pages(command.mode) // передаём все страницы проекта для сборщика
        },
    }

    // настройки плагинов
    const plugins = [
        // активация Nunjucks
        nunjucks(),

        // активация Nunjucks с фильтрами
        // nunjucks({
        //     nunjucksEnvironment: {
        //         filters: {
        //             formatMoney: formatMoney
        //         }
        //     }
        // }),

        // автоматическое обновление всего приложения при изменении .njk (теперь любых) файлов
        FullReload(
            [
                'config/routes.rb',
                "/app/**/*"
            ],
            {always: true}
        ),

        // Минификация html при сборке
        htmlMinifier({
            minify: true,
        }),
    ]
    

    return {
        ...global,
        server,
        preview,
        build,
        plugins
    }
})