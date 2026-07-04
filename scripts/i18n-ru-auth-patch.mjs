#!/usr/bin/env node
/** Fill remaining RU translations for auth, settings, cloud sync */
import fs from "node:fs";
import path from "node:path";

const ruPath = path.join(process.cwd(), "src/i18n/locales/ru.json");
const ru = JSON.parse(fs.readFileSync(ruPath, "utf8"));

const PATCH = {
  account: "Аккаунт",
  authChangeEmail: "Сменить email",
  authChangeEmailSubtitle: "Мы можем отправить ссылку подтверждения на новый адрес.",
  authEmailBackToSignIn: "Вернуться ко входу",
  authEmailCheckBody: "Мы отправили письмо для подтверждения. Открой его, подтверди аккаунт и войди в YouTrader с email и паролем.",
  authEmailCheckTitle: "Проверь email",
  authEmailConfirmPasswordPlaceholder: "Подтверди пароль",
  authEmailCreateAccount: "Создать аккаунт",
  authEmailCreateAccountLink: "Создать аккаунт",
  authEmailForgotPassword: "Забыл пароль?",
  authEmailForgotTitle: "Забыл пароль?",
  authEmailPasswordPlaceholder: "Пароль",
  authEmailSendReset: "Отправить письмо для сброса",
  authEmailSignIn: "Войти",
  authEmailSignInTitle: "Вход",
  authEmailSignUpTitle: "Создать аккаунт",
  authEmailTitle: "Вход через Email",
  authSecureNote: "Данные синхронизируются безопасно с аккаунтом YouTrader.",
  authSubtitle: "Хватит гадать метрики. Веди журнал, анализируй результат и усиливай edge с помощью AI.",
  authTermsAnd: " и ",
  authTermsPrefix: "Продолжая, ты соглашаешься с ",
  authUpdateEmail: "Обновить email",
  cloudSyncActive: "Облачная синхронизация активна",
  cloudSyncError: "Синхронизация приостановлена. Изменения сохранены локально и будут повторены.",
  cloudSynced: "Журнал синхронизирован между устройствами.",
  cloudSyncing: "Синхронизация журнала...",
  signInUnavailable: "Вход недоступен",
  signInUnavailableBody: "Облачный вход недоступен в этой сборке. Журнал на устройстве всё ещё работает.",
  signOut: "Выйти",
  signedInAs: "Вошёл как",
  madeByTraders: "СДЕЛАНО ТРЕЙДЕРОМ ДЛЯ ТРЕЙДЕРОВ",
  marketIntelHeader: "Brave Market Intelligence",
  marketIntelSub: "Инструменты Pro на основе live-заголовков и облачного AI.",
  generate: "Сгенерировать",
  todaysVolatility: "Волатильность сегодня",
  freeLocalCoach: "Бесплатный локальный коуч",
  stayFree: "Остаться на Free",
  upgradeToProCta: "Перейти на Pro",
  settingsProBenefit1: "AI-анализ сделок с обучающей обратной связью",
  settingsProBenefit2: "AI Pattern Detective — скрытые слепые зоны и повторяющиеся паттерны",
  settingsProBenefit3: "Prop Firm Coach: survival score, pass probability и дневной буфер",
  settingsProBenefit4: "Алерты нарушения правил и детекция revenge-trading",
  settingsProBenefit5: "Детекция скрытых утечек для защиты edge",
  settingsProBenefit6: "Безлимитный торговый журнал",
  settingsProBenefit7: "Скриншоты, фото и голосовые заметки для каждого сетапа",
  settingsProBenefit8: "Облачная синхронизация и бэкап на всех устройствах",
  settingsProBenefit9: "Импорт истории сделок через CSV",
  settingsProBenefit10: "Экспорт и шеринг отчётов журнала",
  settingsProBenefit11: "Profit Factor, Expectancy, Sharpe Ratio, Consistency и Drawdown",
  settingsProBenefit12: "Самые прибыльные символы, сессии и часы торговли",
  settingsProBenefit13: "Heatmap сессий и анализ edge по часам",
  settingsProBenefit14: "Trading Score, достижения и прогресс статуса трейдера",
  settingsProBenefit15: "Продвинутая аналитика и отслеживание edge",
  settingsProBenefit16: "Полный профиль performance и radar-анализ",
  settingsProBenefit17: "Ежедневные напоминания о риске проп-фирмы",
  settingsProBenefit18: "Market Pulse — новости и финансовые обновления в реальном времени",
  settingsProBenefit19: "Многодневный экономический календарь: CPI, PPI, FOMC, NFP, GDP и др.",
  hiddenLeaksBenefit: "Hidden Leaks, Revenge Alerts, Pattern Detective",
  youTraderRiskCoach: "YouTrader Risk Coach",
  weekPnl: "P&L недели",
  ok: "OK",
  moodFomo: "FOMO",
};

Object.assign(ru, PATCH);
fs.writeFileSync(ruPath, `${JSON.stringify(Object.fromEntries(Object.keys(ru).sort().map((k) => [k, ru[k]])), null, 2)}\n`);

const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/i18n/locales/en.json"), "utf8"));
const still = Object.keys(en).filter((k) => en[k] === ru[k]).length;
console.log(`RU patch applied: ${Object.keys(PATCH).length} keys, ${still} still match EN`);
