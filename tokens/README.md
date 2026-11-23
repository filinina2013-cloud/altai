# Токены ALTAI

`altai-tokens.tokens-studio.json` — все переменные дизайн-системы из Figma в формате Tokens Studio.

| Набор | Что внутри |
|---|---|
| Primitives | Палитра (stone, slate, spruce, hearth, larch, wood, red), шкала отступов, радиусы, толщины линий, размеры, шрифты, кегли, интерлиньяж, трекинг, длительности |
| Foundations | Смысловые отступы (inline, stack, inset), сетка и отступы секций для ПК / планшета / телефона, радиусы, размеры контролов, брейкпоинты |
| Colors/Light, Colors/Dark | Цвета текста, поверхностей, рамок, действий, состояний, стекла, затемнений, теней и темы памятки — светлая и тёмная |
| Components | Кнопки, поля, радио-карточки, вкладки, аккордеон, теги, фокус, карта |

Темы: **Light** и **Dark** (`$themes`). Ссылки между токенами — в формате `{color.slate.900}`.

## Как подключить

Tokens Studio → Settings → Sync → GitHub, путь к файлу `tokens/altai-tokens.tokens-studio.json`.
Или Tools → Load from file.

Сайт использует те же значения в `css/tokens.css` (и `css/sections.css` для новых): например,
`layout/*/stack` = `--layout-stack` (48 / 32 / 24), `Elevation/Modal soft` = `--shadow-modal-soft`, `Elevation/Card soft` = `--shadow-card-soft`.

Выгружено из Figma 23 ноября 2026.
