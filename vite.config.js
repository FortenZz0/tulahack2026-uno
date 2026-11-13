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
const pages = Object.fromEntries(glob.sync("app/**/*.html").map(file => [
    path.relative(
        'app',
        file.slice(0, file.length - path.extname(file).length)
    ),
    fileURLToPath(new URL(file, import.meta.url))
]))
console.log(pages)


// Фильтры
const formatMoney = (val) => { // получает int(1234567), возвращает str(1 234 567)
    let result = ""
    let v = val.toString()
    for (let i = 0; i < v.length; i++) {
        if (i % 3 === 0 && i !== 0)
            result = `${v[v.length-1 - i]} ` + result
        else
            result = v[v.length-1 - i] + result
    }

    return result
}


export default defineConfig((command) => {
    const global = {
        root: "app", // назначаем корневую директорию проекта

        clearScreen: false, // отключаем очистку консоли при запуске сервера
    }

    // настройки для dev сервера
    const server = {
        open: true, // при запуске открываем страницу в браузере
        host: true, // создаём хост для подключения из локальной сети
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
        port: 8081,
    }

    // настройки для сборщика
    const build = {
        cssCodeSplit: false, // отключаем разделение стилей по разным файлам

        outDir: "../dist", // задаём папку для сборки
        emptyOutDir: "../dist", // задаём папку, которую перед сборкой нужно очищать

        rollupOptions: {
            input: pages // передаём все страницы проекта для сборщика
        },
    }

    // настройки плагинов
    const plugins = [
        // активация Nunjucks
        nunjucks.default({
            nunjucksEnvironment: {
                filters: {
                    formatMoney: formatMoney
                }
            }
        }),

        // автоматическое обновление страницы при изменении любых файлов
        FullReload(['config/routes.rb', 'app/**/*'], {always: true}),

        // Минификация html при prod-сборке
        htmlMinifier({
            minify: command.mode == "prod",
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