-- =====================================================================
-- Metka — БД строго по ERD (images/erd metka.png). PostgreSQL.
-- Исправленная версия: ограничения, индексы, ON DELETE, тестовые данные.
-- Названия таблиц и полей не изменены.
-- =====================================================================

DROP TABLE IF EXISTS note       CASCADE;
DROP TABLE IF EXISTS tag        CASCADE;
DROP TABLE IF EXISTS "user"     CASCADE;
DROP TABLE IF EXISTS role       CASCADE;
DROP TABLE IF EXISTS permission CASCADE;

-- ---------------------------------------------------------------------
-- 1. permission
-- ---------------------------------------------------------------------
CREATE TABLE permission (
    id    INT          PRIMARY KEY,          -- без IDENTITY, т.к. связан 1:1 с role
    name  VARCHAR(100) NOT NULL
);

-- ---------------------------------------------------------------------
-- 2. role
-- ---------------------------------------------------------------------
CREATE TABLE role (
    id    INT         PRIMARY KEY,           -- без IDENTITY, т.к. связан 1:1 с permission
    name  VARCHAR(50) NOT NULL
);

-- Взаимные FK (как на ERD). DEFERRABLE — чтобы можно было вставлять в одной транзакции.
ALTER TABLE permission
    ADD CONSTRAINT fk_permission_role
    FOREIGN KEY (id) REFERENCES role (id)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE role
    ADD CONSTRAINT fk_role_permission
    FOREIGN KEY (id) REFERENCES permission (id)
    DEFERRABLE INITIALLY DEFERRED;

-- ---------------------------------------------------------------------
-- 3. user
-- ---------------------------------------------------------------------
CREATE TABLE "user" (
    id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    login     VARCHAR(50)  NOT NULL,
    password  VARCHAR(255) NOT NULL,
    role_id   INT          NOT NULL REFERENCES role (id) ON DELETE RESTRICT
);

-- Уникальный логин (обязательно для аутентификации)
CREATE UNIQUE INDEX idx_user_login ON "user" (login);

-- ---------------------------------------------------------------------
-- 4. tag
-- ---------------------------------------------------------------------
CREATE TABLE tag (
    id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name     VARCHAR(50)  NOT NULL,
    color    VARCHAR(20),
    user_id  INT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX idx_tag_user_id ON tag (user_id);

-- ---------------------------------------------------------------------
-- 5. note
-- ---------------------------------------------------------------------
CREATE TABLE note (
    id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title    VARCHAR(255),
    text     TEXT,
    date     TIMESTAMP DEFAULT NOW(),
    user_id  INT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX idx_note_user_id ON note (user_id);
CREATE INDEX idx_note_date    ON note (date);

-- ---------------------------------------------------------------------
-- 6. note_tag (связь многие-ко-многим между заметками и тегами)
-- ---------------------------------------------------------------------
CREATE TABLE note_tag (
    note_id INT NOT NULL REFERENCES note (id) ON DELETE CASCADE,
    tag_id  INT NOT NULL REFERENCES tag (id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_note_tag_note_id ON note_tag (note_id);
CREATE INDEX idx_note_tag_tag_id  ON note_tag (tag_id);

-- =====================================================================
-- ТЕСТОВЫЕ ДАННЫЕ
-- 5 пользователей, роли, права, заметки и теги
-- =====================================================================

BEGIN;

-- Роли и права (id совпадают из-за 1:1)
INSERT INTO role (id, name) VALUES
    (1, 'admin'),
    (2, 'user');

INSERT INTO permission (id, name) VALUES
    (1, 'manage_users'),
    (2, 'manage_own_notes');

-- 5 пользователей
INSERT INTO "user" (name, login, password, role_id) VALUES
    ('Иван Петров',     'ivan',     'hash_ivan_1',  2),
    ('Мария Сидорова',  'maria',    'hash_maria_2', 2),
    ('Пётр Иванов',     'petr',     'hash_petr_3',  2),
    ('Анна Козлова',    'anna',     'hash_anna_4',  2),
    ('Админ Системы',   'admin',    'hash_admin_5', 1);

-- Заметки (10 штук)
INSERT INTO note (title, text, user_id, date) VALUES
    ('Купить хлеб',           'Не забыть цельнозерновой',           1, NOW() - INTERVAL '2 days'),
    ('Позвонить маме',        'Вечером после 19:00',                1, NOW() - INTERVAL '1 day'),
    ('Идея для проекта',      'Сделать тёмную тему в приложении',   1, NOW()),
    ('Сделать зарядку',       '30 минут утром',                     2, NOW() - INTERVAL '3 days'),
    ('Прочитать книгу',       'Главы 5–7 «Clean Code»',             2, NOW() - INTERVAL '1 day'),
    ('Встреча с клиентом',    'Обсудить ТЗ, подготовить вопросы',   3, NOW()),
    ('Список покупок',        'Молоко, яйца, сыр, яблоки',          3, NOW() - INTERVAL '5 hours'),
    ('План на неделю',        'Пн — бэкенд, Ср — тесты, Пт — релиз', 4, NOW() - INTERVAL '2 days'),
    ('Заметка админа',        'Проверить логи и модерацию',         5, NOW()),
    ('Рецепт пасты',          'Спагетти + томатный соус + базилик', 4, NOW() - INTERVAL '4 days');

-- Теги (привязаны к пользователям и связаны со заметками через note_tag)
INSERT INTO tag (name, color, user_id) VALUES
    ('еда',        '#FF6B6B', 1),
    ('личное',     '#4ECDC4', 1),
    ('работа',     '#45B7D1', 1),
    ('спорт',      '#96CEB4', 2),
    ('чтение',     '#FFEAA7', 2),
    ('клиенты',    '#DDA0DD', 3),
    ('покупки',    '#98D8C8', 3),
    ('планирование','#F7DC6F', 4),
    ('админ',      '#BB8FCE', 5),
    ('рецепты',    '#F1948A', 4);

INSERT INTO note_tag (note_id, tag_id) VALUES
    (1, 1), (2, 2), (3, 3),
    (4, 4), (5, 5), (6, 6),
    (7, 7), (8, 8), (9, 9),
    (10, 10);

COMMIT;

-- =====================================================================
-- 3 SELECT-запроса (доказательство, что БД работает)
-- =====================================================================

-- 1. Все заметки пользователя с id = 1 + связанные теги
SELECT n.id, n.title, n.text, n.date, t.name AS tag_name, t.color
FROM note n
LEFT JOIN note_tag nt ON nt.note_id = n.id
LEFT JOIN tag t ON t.id = nt.tag_id
WHERE n.user_id = 1
ORDER BY n.date DESC;

-- 2. Только заметки, у которых есть хотя бы один тег
SELECT n.id, n.title, t.name AS tag, u.login AS author
FROM note n
JOIN note_tag nt ON nt.note_id = n.id
JOIN tag t ON t.id = nt.tag_id
JOIN "user" u ON n.user_id = u.id
ORDER BY n.date DESC;

-- 3. Сколько заметок у каждого пользователя (агрегация)
SELECT u.id, u.login, u.name, COUNT(n.id) AS note_count
FROM "user" u
LEFT JOIN note n ON n.user_id = u.id
GROUP BY u.id, u.login, u.name
ORDER BY note_count DESC;