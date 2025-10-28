# Manga4U Front-end — minimal Vite + ESLint + Prettier setup

Что сделано:

- Добавлен `package.json` с базовыми скриптами: `dev`, `build`, `preview`, `lint`, `format`.
- Настроен `vite.config.js` для локальной разработки.
- Добавлен `.eslintrc.cjs` и `.prettierrc`.
- Добавлены `.env.development` и `.env.production` с примером `VITE_API_BASE`.
- `js/auth.js` использует build-time переменную Vite `VITE_API_BASE` (см. ниже).

Как использовать (локально):

1. Установить зависимости:

```pwsh
npm install
```

2. Запустить dev сервер (Vite):

```pwsh
npm run dev
```

3. Изменить базовый API URL во время разработки и при билде:

- Рекомендуемый способ (build-time, стандарт для Vite): укажите `VITE_API_BASE` в `.env.development` или `.env.production`. В коде используется `import.meta.env.VITE_API_BASE`.
	Обратите внимание: `VITE_API_BASE` теперь обязательна — сборка и рантайм будут выбрасывать ошибку, если переменная не задана.

- Пример локального `.env.development`:

```text
VITE_API_BASE="http://localhost:7220"
```

При запуске `npm run dev` Vite подхватит `.env.development`. При `npm run build` будет использовано `.env.production`.

Lint и форматирование:

```pwsh
npm run lint
npm run format
```

Дальше я могу:

- Подключить `eslint-plugin-html` для линта HTML-файлов (в package.json уже указан в devDeps),
- Поэтапно перевести скрипты в ES Modules и использовать `import.meta.env` (чтобы брать `VITE_API_BASE` автоматически),
- Добавить GitHub Actions для запуска линта/тестов.

Скажите, хотите ли сразу, чтобы я:

1. Перевёл часть `js/` скриптов в ES Modules и использовал `import.meta.env.VITE_API_BASE` (это потребует правки HTML, чтобы подключать с `type="module"`).
2. Добавил GitHub Actions для запуска линта и сборки при PR.
