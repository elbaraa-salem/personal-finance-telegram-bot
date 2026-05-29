import { defaultLanguage, SupportedLanguage } from "./language";

export type MenuMessages = {
  addIncome: string;
  addExpense: string;
  addFamilyExpense: string;
  addPersonalExpense: string;
  manualEntry: string;
  backToMainMenu: string;
  chooseOperationType: string;
  reportAll: string;
  reportDay: string;
  reportWeek: string;
  reportMonth: string;
  reportYear: string;
  history: string;
  help: string;
  deleteLast: string;
  language: string;
  currency: string;
  expenseModeSettingsButton: string;
  timezoneSettings: string;
  moreReports: string;
  settings: string;
};

type ReportMessages = {
  titles: {
    all: string;
    day: string;
    week: string;
    month: string;
    year: string;
  };
  totalIncome: string;
  totalExpense: string;
  balance: string;
  transactionCount: string;
  incomeSection: string;
  personalExpenseSection: string;
  familyExpenseSection: string;
  total: string;
  noItems: string;
  customRangeButton: string;
  customRangeFromQuestion: string;
  customRangeToQuestion: string;
  invalidDate: string;
  endDateBeforeStartDate: string;
  customTitle: (from: string, to: string) => string;
  excelButton: string;
  excelPreparing: string;
  excelNoTransactions: string;
  waitingForDateInput: string;
};

type TransactionMessages = {
  type: string;
  income: string;
  expense: string;
  scope: string;
  personalScope: string;
  familyScope: string;
  scopePersonal: string;
  scopeFamily: string;
  amount: string;
  category: string;
  date: string;
  note: string;
  createdSuccessfully: (type: string) => string;
};

type HistoryMessages = {
  titles: {
    recent: (count: number) => string;
    date: (date: string) => string;
    month: (month: string) => string;
    day: string;
    week: string;
    year: string;
  };
  empty: string;
  noTransactionsYet: string;
  noTransactionsInMonth: string;
  chooseReportMonth: string;
  chooseHistoryMonth: string;
  previousPage: string;
  nextPage: string;
  page: (page: number, totalPages: number) => string;
  invalidUsage: string;
};

type TransactionFlowMessages = {
  start: (type: string) => string;
  askCategory: string;
  askDate: string;
  askNote: string;
  invalidAmount: string;
  invalidDate: string;
  emptyCategory: string;
  noActiveFlow: string;
  cancelled: string;
  activeFlowWarning: string;
  dataError: string;
  readUserError: string;
  cancelButton: string;
};

type DeleteMessages = {
  confirmation: string;
  deleteReceiptConfirm: (count: number) => string;
  deleteReceiptSuccess: (count: number) => string;
  deleteReceiptAlreadyDeleted: string;
  deleteReceiptFailed: string;
  confirmButton: string;
  cancelButton: string;
  cancelled: string;
  deletedSuccessfully: (type: string) => string;
  amount: string;
  category: string;
  date: string;
  readUserError: string;
};

type ManualTransactionMessages = {
  incomeUsage: string;
  expenseUsage: string;
  shortcutUsage: string;
  readUserError: string;
  unexpectedError: string;
};

type NaturalTransactionMessages = {
  aiNotConfigured: string;
  parseFailed: string;
  notDetected: string;
  askScope: string;
  saved: string;
  noScopeSession: string;
};

type ReceiptMessages = {
  receiptFound: string;
  receiptDate: string;
  receiptTotal: string;
  receiptTransactionsToCreate: string;
  receiptSaveQuestion: string;
  receiptSaveButton: string;
  receiptCancelButton: string;
  receiptSaved: string;
  receiptAlreadySaved: string;
  receiptCancelled: string;
  receiptCouldNotImport: string;
  receiptAiNotConfigured: string;
  receiptNoItems: string;
  groupedTotalDiffers: string;
  receiptChooseScopeAndConfirmAmount: string;
  receiptCurrentScope: string;
  qrImageProcessing: string;
  qrImageDecodeFailed: string;
  qrImageUnsupportedFile: string;
  receiptExpenseOnly: string;
};

type CommonMessages = {
  readUserError: string;
  unexpectedError: string;
  actionCancelled: string;
};

type VoiceMessages = {
  voiceDisabled: string;
  voiceTranscribing: string;
  voiceTranscriptionFailed: string;
  voiceRecognizedText: (text: string) => string;
};

type CurrencyMessages = {
  choose: string;
  selected: (currency: string) => string;
  customButton: string;
  customPrompt: string;
  invalidCustom: string;
};

type ExpenseScopeModeMessages = {
  question: string;
  separate: string;
  personalOnly: string;
  familyOnly: string;
  updated: string;
  fixedBySettings: string;
};

type TimezoneMessages = {
  choose: string;
  updated: (timezone: string) => string;
};

type Messages = {
  common: CommonMessages;
  start: {
    chooseLanguage: string;
    welcome: string;
  };
  language: {
    selected: string;
    ready: string;
    unsupported: string;
  };
  help: {
    text: (currency: string) => string;
  };
  menu: MenuMessages;
  report: ReportMessages;
  transaction: TransactionMessages;
  history: HistoryMessages;
  transactionFlow: TransactionFlowMessages;
  naturalTransaction: NaturalTransactionMessages;
  receipt: ReceiptMessages;
  voice: VoiceMessages;
  delete: DeleteMessages;
  manualTransaction: ManualTransactionMessages;
  currency: CurrencyMessages;
  expenseScopeMode: ExpenseScopeModeMessages;
  timezone: TimezoneMessages;
};

export const translations: Record<SupportedLanguage, Messages> = {
  ar: {
    common: {
        readUserError: "لم أستطع قراءة بيانات المستخدم.",
        unexpectedError: "حدث خطأ غير متوقع.",
        actionCancelled: "تم إلغاء العملية.",
    },
    start: {
      chooseLanguage: "اختر اللغة / Выберите язык / Choose language:",
      welcome:
        "أهلًا بك 👋\n" +
        "تم تسجيلك في بوت المصاريف.\n\n" +
        "استخدم الأزرار بالأسفل أو اكتب /help لعرض الأوامر.",
    },
    language: {
      selected: "تم اختيار اللغة العربية ✅",
      ready: "يمكنك الآن استخدام البوت من القائمة.",
      unsupported: "هذه اللغة غير مدعومة.",
    },
    currency: {
        choose: "اختر العملة التي تريد استخدامها:",
        selected: (currency: string) => `تم اختيار العملة: ${currency} ✅`,
        customButton: "عملة مخصصة",
        customPrompt:
            "اكتب العملة التي تريد استخدامها.\n\n" +
            "مثال:\n" +
            "USDT\n" +
            "BYN\n" +
            "₽\n" +
            "$",
        invalidCustom:
            "العملة غير صحيحة.\n" +
            "اكتب رمزًا قصيرًا للعملة، مثال: USD أو RUB أو ₽.",
    },
    expenseScopeMode: {
        question: "كيف تريد تسجيل المصروفات؟",
        separate: "👥 فصل الشخصي والأسري",
        personalOnly: "👤 كل المصروفات شخصية",
        familyOnly: "🏠 كل المصروفات أسرية",
        updated: "تم تحديث طريقة تسجيل المصروفات.",
        fixedBySettings: "نوع المصروفات ثابت من الإعدادات.",
    },
    timezone: {
        choose: "اختر المنطقة الزمنية:",
        updated: (timezone: string) => `تم تحديث المنطقة الزمنية: ${timezone}`,
    },
    report: {
        titles: {
            all: "📊 التقرير الكامل",
            day: "📊 تقرير اليوم",
            week: "📊 تقرير هذا الأسبوع",
            month: "📊 تقرير هذا الشهر",
            year: "📊 تقرير هذه السنة",
        },
        totalIncome: "إجمالي الدخل",
        totalExpense: "إجمالي المصروف",
        balance: "الرصيد",
        transactionCount: "عدد العمليات",
        incomeSection: "📈 الدخل:",
        personalExpenseSection: "📉 المصروفات الشخصية:",
        familyExpenseSection: "🏠 المصروفات الأسرية:",
        total: "الإجمالي",
        noItems: "لا توجد عمليات.",
        customRangeButton: "📅 اختيار يدوي",
        customRangeFromQuestion: "من أي تاريخ؟ اكتب التاريخ بهذا الشكل: 22-05-2026",
        customRangeToQuestion: "إلى أي تاريخ؟ اكتب التاريخ بهذا الشكل: 29-05-2026",
        invalidDate: "التاريخ غير صحيح. اكتب التاريخ بهذا الشكل: 22-05-2026",
        endDateBeforeStartDate: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساويًا له.",
        customTitle: (from: string, to: string) => `📊 تقرير من ${from} إلى ${to}:`,
        excelButton: "📊 أريد ملف Excel",
        excelPreparing: "جاري تجهيز ملف Excel...",
        excelNoTransactions: "لا توجد عمليات في هذه الفترة.",
        waitingForDateInput: "أنا الآن أنتظر تاريخ التقرير. اكتب التاريخ مثل 22-05-2026 أو أرسل «إلغاء».",
    },
    transaction: {
        type: "النوع",
        income: "دخل",
        expense: "مصروف",
        scope: "النطاق",
        personalScope: "شخصي",
        familyScope: "أسري",
        scopePersonal: "شخصية",
        scopeFamily: "أسرية",
        amount: "المبلغ",
        category: "التصنيف",
        date: "التاريخ",
        note: "ملاحظة",
        createdSuccessfully: (type: string) => `✅ تم إضافة ${type} بنجاح`,
        },
        history: {
        titles: {
            recent: (count: number) => `🧾 آخر ${count} عملية`,
            date: (date: string) => `🧾 عمليات يوم ${date}`,
            month: (month: string) => `🧾 عمليات شهر ${month}`,
            day: "🧾 عمليات اليوم",
            week: "🧾 عمليات هذا الأسبوع",
            year: "🧾 عمليات هذه السنة",
        },
        empty: "لا توجد عمليات في هذه الفترة.",
        noTransactionsYet: "لا توجد عمليات بعد.",
        noTransactionsInMonth: "لا توجد عمليات في هذا الشهر.",
        chooseReportMonth: "اختر الشهر الذي تريد تقريره:",
        chooseHistoryMonth: "اختر الشهر لعرض العمليات:",
        previousPage: "السابق",
        nextPage: "التالي",
        page: (page: number, totalPages: number) => `صفحة ${page} من ${totalPages}`,
        invalidUsage:
            "استخدم الأمر بهذا الشكل:\n" +
            "/history\n" +
            "/history 10\n" +
            "/history 2026-05-04",
    },
    transactionFlow: {
        start: (type: string) =>
            `حسنًا، سنضيف ${type}.\n\n` +
            "اكتب العملية بطريقة طبيعية، مثال:\n" +
            "اشتريت لحمة للبيت قبل يومين بألفين روبل",

        askCategory: "",
        askDate: "",
        askNote: "",

        invalidAmount:
            "الصيغة غير صحيحة.\n\n" +
            "اكتب العملية بهذا الشكل:\n" +
            "1500 راتب\n\n" +
            "أو مع التاريخ والملاحظة:\n" +
            "1500 التصنيف YYYY-MM-DD الملاحظة\n\n" +
            "أو اكتب /cancel للإلغاء.",

        invalidDate:
            "صيغة التاريخ غير صحيحة.\n\n" +
            "اكتب التاريخ بهذا الشكل:\n" +
            "YYYY-MM-DD",

        emptyCategory: "التصنيف لا يمكن أن يكون فارغًا.",
        noActiveFlow: "لا توجد عملية جارية لإلغائها.",
        cancelled: "تم إلغاء العملية الحالية.",

        activeFlowWarning:
            "لديك عملية إضافة جارية الآن.\n\n" +
            "اكتب العملية في سطر واحد أو اضغط زر الإلغاء.",

        dataError: "حدث خطأ في بيانات العملية. ابدأ من جديد.",
        readUserError: "لم أستطع قراءة بيانات المستخدم.",
        cancelButton: "❌ إلغاء العملية",
    },
    naturalTransaction: {
        aiNotConfigured: "AI parsing is not configured yet.",
        parseFailed: "حدث خطأ أثناء تحليل الرسالة. حاول مرة أخرى بعد قليل.",
        notDetected:
            "لم أستطع استخراج عملية مالية من هذه الرسالة. اكتب مثلًا: اشتريت طعامًا للبيت بـ 500 روبل",
        askScope: "هل هذه العملية شخصية أم أسرية؟",
        saved: "✅ تم تسجيل العملية:",
        noScopeSession: "لا توجد عملية بانتظار تحديد النطاق.",
    },
    receipt: {
        receiptFound: "🧾 تم العثور على شيك",
        receiptDate: "التاريخ",
        receiptTotal: "الإجمالي",
        receiptTransactionsToCreate: "سيتم إنشاء العمليات",
        receiptSaveQuestion: "هل تريد حفظ العمليات؟",
        receiptSaveButton: "✅ حفظ",
        receiptCancelButton: "❌ إلغاء",
        receiptSaved: "✅ تم حفظ عمليات الشيك.",
        receiptAlreadySaved: "تم حفظ هذا الشيك من قبل.",
        receiptCancelled: "تم إلغاء استيراد الشيك.",
        receiptCouldNotImport: "لم أستطع استيراد هذا الشيك. حاول مرة أخرى لاحقًا.",
        receiptAiNotConfigured: "تحليل الشيك بالذكاء الاصطناعي غير مفعّل.",
        receiptNoItems: "لم أجد عناصر في الشيك.",
        groupedTotalDiffers: "⚠️ إجمالي المجموعات يختلف عن إجمالي الشيك.",
        receiptChooseScopeAndConfirmAmount: "اختر نوع المصروف وتأكد أن المبلغ صحيح:",
        receiptCurrentScope: "النطاق",
        qrImageProcessing: "جاري قراءة QR من الصورة...",
        qrImageDecodeFailed: "لم أستطع قراءة QR من الصورة. جرّب إرسال صورة أقرب للكود بدون انعكاس أو اهتزاز، أو أرسل الصورة كملف.",
        qrImageUnsupportedFile: "هذا الملف ليس صورة مدعومة.",
        receiptExpenseOnly: "الشيكات مدعومة للمصروفات فقط. ألغِ وضع الدخل أو اختر نوع مصروف.",
    },
    voice: {
        voiceDisabled: "الإدخال الصوتي غير مفعّل حاليًا.",
        voiceTranscribing: "جاري تحويل الصوت إلى نص...",
        voiceTranscriptionFailed: "لم أستطع فهم الرسالة الصوتية. حاول تسجيلها بوضوح أكثر.",
        voiceRecognizedText: (text: string) => `فهمت النص التالي:\n${text}`,
    },
    delete: {
        confirmation: "هل أنت متأكد أنك تريد حذف آخر عملية؟",
        deleteReceiptConfirm: (count: number) =>
            `آخر عملية تابعة لشيك. هل تريد حذف كل العمليات الخاصة بهذا الشيك؟ العدد: ${count}`,
        deleteReceiptSuccess: (count: number) =>
            `تم حذف كل العمليات الخاصة بآخر شيك: ${count}`,
        deleteReceiptAlreadyDeleted: "تم حذف هذا الشيك من قبل.",
        deleteReceiptFailed: "تعذر حذف عمليات الشيك.",
        confirmButton: "نعم، احذف",
        cancelButton: "إلغاء",
        cancelled: "تم إلغاء الحذف.",
        deletedSuccessfully: (type: string) => `تم حذف آخر ${type}`,
        amount: "المبلغ",
        category: "التصنيف",
        date: "التاريخ",
        readUserError: "لم أستطع قراءة بيانات المستخدم.",
    },
    manualTransaction: {
        incomeUsage:
            "استخدم أمر الدخل بهذا الشكل:\n" +
            "/income 1500 salary\n" +
            "/income 1500 salary 2026-05-05 bonus\n\n" +
            "أو بالاختصار:\n" +
            "+ 1500 salary\n" +
            "+ 1500 salary 2026-05-05 bonus",

        expenseUsage:
            "استخدم أمر المصروف بهذا الشكل:\n" +
            "/expense 250 food\n" +
            "/expense 250 food 2026-05-05 lunch\n\n" +
            "أو بالاختصار:\n" +
            "- 250 food\n" +
            "- 250 food 2026-05-05 lunch",

        shortcutUsage:
            "استخدم الاختصار بهذا الشكل:\n" +
            "+ 1500 salary\n" +
            "- 250 food\n\n" +
            "ويمكنك إضافة التاريخ والملاحظة:\n" +
            "+ 1500 salary 2026-05-05 bonus\n" +
            "- 250 food 2026-05-05 lunch",

        readUserError: "لم أستطع قراءة بيانات المستخدم.",
        unexpectedError: "حدث خطأ غير متوقع.",
    },

    help: {
    text: (currency: string) =>
            `
        👋 مرحبًا بك في SmartSpendBot

        يساعدك SmartSpendBot على تسجيل الدخل والمصروفات، ومتابعة التقارير، ومراجعة التاريخ، وتصدير التقارير إلى ملف Excel.

        💬 الإضافة السريعة بالنص:
        يمكنك أن تكتب العملية بلغة عادية، وسيحاول البوت فهم المبلغ، ونوع العملية، والتصنيف، والتاريخ، والملاحظة.

        أمثلة:
        + 1500 عمل
        - 250 طعام
        استلمت 3000 من درس مع ماريا 17-05-2026
        ярче продукты 2026-05-01 1233
        vpn 141 16-05-2026

        📅 التواريخ:
        يمكنك كتابة التاريخ بهذه الصيغ:
        17-05-2026
        17.05.2026
        17/05/2026
        2026-05-17
        2026.05.17
        2026/05/17

        إذا لم تكتب التاريخ، سيستخدم البوت تاريخ اليوم.

        💰 الإدخال اليدوي:
        من زر "الإدخال اليدوي" يمكنك إضافة:
        • دخل
        • مصروف شخصي
        • مصروف أسري

        إذا اخترت في الإعدادات وضع المصروفات الشخصية فقط أو الأسرية فقط، فلن يسألك البوت كل مرة عن نوع المصروف.

        🧾 الشيكات و QR:
        يمكنك إرسال QR الخاص بالشيك كنص أو كصورة.
        سيحاول البوت قراءة الشيك، وتجميع المشتريات، وعرض معاينة قبل الحفظ.
        لن يتم حفظ العمليات إلا بعد تأكيدك.

        📊 التقارير:
        يمكنك عرض:
        • تقرير اليوم
        • تقارير الشهور
        • تقرير لفترة تختارها يدويًا

        في "تقارير أخرى" يعرض البوت الشهور التي تحتوي على عمليات، مع زر لاختيار فترة يدوية.

        📊 Excel:
        تحت كل تقرير يوجد زر "أريد ملف Excel".
        الملف يحتوي على عمليات نفس الشهر أو نفس الفترة:
        • التاريخ
        • النوع
        • شخصي/أسري
        • المبلغ
        • التصنيف
        • الملاحظة
        • تاريخ الإنشاء

        🧾 التاريخ:
        يعرض التاريخ الشهور التي تحتوي على عمليات.
        بعد اختيار شهر، يعرض البوت العمليات الخاصة بهذا الشهر.

        🗑 الحذف:
        يمكنك حذف آخر عملية بعد التأكيد.
        إذا كانت آخر عملية جزءًا من شيك، فسيحذف البوت كل عمليات هذا الشيك معًا.

        ⚙️ الإعدادات:
        يمكنك تغيير:
        • اللغة
        • العملة
        • وضع المصروفات: فصل الشخصي والأسري / شخصي فقط / أسري فقط

        العملة الحالية: ${currency}
        `.trim(),
    },
    menu: {
      addIncome: "➕ إضافة دخل",
      addExpense: "➖ إضافة مصروف",
      addFamilyExpense: "🏠 إضافة مصروف أسري",
      addPersonalExpense: "👤 إضافة مصروف شخصي",
      manualEntry: "✍️ إدخال يدوي",
      backToMainMenu: "⬅️ القائمة الرئيسية",
      chooseOperationType: "اختر نوع العملية:",
      reportAll: "📊 التقرير الكامل",
      reportDay: "📅 تقرير اليوم",
      reportWeek: "📆 تقرير الأسبوع",
      reportMonth: "🗓 تقرير الشهر",
      reportYear: "📈 تقرير السنة",
      history: "🧾 آخر العمليات",
      help: "ℹ️ المساعدة",
      deleteLast: "🗑 حذف آخر عملية",
      language: "🌐 اللغة / Language",
      currency: "💱 العملة",
      expenseModeSettingsButton: "👥 نوع المصروفات",
      timezoneSettings: "🌍 المنطقة الزمنية",
      moreReports: "📊 تقارير أخرى",
      settings: "⚙️ الإعدادات",
    },
  },

  ru: {
    common: {
        readUserError: "Не удалось прочитать данные пользователя.",
        unexpectedError: "Произошла непредвиденная ошибка.",
        actionCancelled: "Действие отменено.",
    },
    start: {
      chooseLanguage: "Выберите язык:",
      welcome:
        "Добро пожаловать 👋\n" +
        "Вы зарегистрированы в боте учёта расходов.\n\n" +
        "Используйте кнопки ниже или введите /help, чтобы посмотреть команды.",
    },
    language: {
      selected: "Русский язык выбран ✅",
      ready: "Теперь вы можете пользоваться ботом из меню.",
      unsupported: "Этот язык не поддерживается.",
    },
    currency: {
        choose: "Выберите валюту, которую хотите использовать:",
        selected: (currency: string) => `Выбрана валюта: ${currency} ✅`,
        customButton: "Своя валюта",
        customPrompt:
            "Введите валюту, которую хотите использовать.\n\n" +
            "Пример:\n" +
            "USDT\n" +
            "BYN\n" +
            "₽\n" +
            "$",
        invalidCustom:
            "Некорректная валюта.\n" +
            "Введите короткое обозначение валюты, например USD, RUB или ₽.",
    },
    expenseScopeMode: {
        question: "Как учитывать расходы?",
        separate: "👥 Разделять личные и семейные",
        personalOnly: "👤 Все расходы личные",
        familyOnly: "🏠 Все расходы семейные",
        updated: "Способ учёта расходов обновлён.",
        fixedBySettings: "Тип расходов закреплён в настройках.",
    },
    timezone: {
        choose: "Выберите часовой пояс:",
        updated: (timezone: string) => `Часовой пояс обновлён: ${timezone}`,
    },
    report: {
        titles: {
            all: "📊 Общий отчёт",
            day: "📊 Отчёт за сегодня",
            week: "📊 Отчёт за эту неделю",
            month: "📊 Отчёт за этот месяц",
            year: "📊 Отчёт за этот год",
        },
        totalIncome: "Общий доход",
        totalExpense: "Общие расходы",
        balance: "Баланс",
        transactionCount: "Количество операций",
        incomeSection: "📈 Доходы:",
        personalExpenseSection: "📉 Личные расходы:",
        familyExpenseSection: "🏠 Семейные расходы:",
        total: "Итого",
        noItems: "Нет операций.",
        customRangeButton: "📅 Выбрать период",
        customRangeFromQuestion: "С какой даты? Напишите дату в формате: 22-05-2026",
        customRangeToQuestion: "До какой даты? Напишите дату в формате: 29-05-2026",
        invalidDate: "Неверная дата. Напишите дату в формате: 22-05-2026",
        endDateBeforeStartDate: "Дата окончания должна быть не раньше даты начала.",
        customTitle: (from: string, to: string) => `📊 Отчёт с ${from} по ${to}:`,
        excelButton: "📊 Скачать Excel",
        excelPreparing: "Готовлю Excel-файл...",
        excelNoTransactions: "Нет операций за этот период.",
        waitingForDateInput: "Сейчас я жду дату для отчёта. Напишите дату в формате 22-05-2026 или отправьте «Отмена».",
    },

    transaction: {
        type: "Тип",
        income: "Доход",
        expense: "Расход",
        scope: "Область",
        personalScope: "личная",
        familyScope: "семейная",
        scopePersonal: "личная",
        scopeFamily: "семейная",
        amount: "Сумма",
        category: "Категория",
        date: "Дата",
        note: "Примечание",
        createdSuccessfully: (type: string) => `✅ ${type} успешно добавлен`,
        },

        history: {
        titles: {
            recent: (count: number) => `🧾 Последние операции: ${count}`,
            date: (date: string) => `🧾 Операции за ${date}`,
            month: (month: string) => `🧾 Операции за ${month}`,
            day: "🧾 Операции за сегодня",
            week: "🧾 Операции за эту неделю",
            year: "🧾 Операции за этот год",
        },
        empty: "В этой период нет операций.",
        noTransactionsYet: "Операций пока нет.",
        noTransactionsInMonth: "В этом месяце нет операций.",
        chooseReportMonth: "Выберите месяц для отчёта:",
        chooseHistoryMonth: "Выберите месяц для просмотра операций:",
        previousPage: "Назад",
        nextPage: "Вперёд",
        page: (page: number, totalPages: number) => `Страница ${page} из ${totalPages}`,
        invalidUsage:
            "Используйте команду так:\n" +
            "/history\n" +
            "/history 10\n" +
            "/history 2026-05-04",
    },
    transactionFlow: {
        start: (type: string) =>
            `Хорошо, добавим ${type}.\n\n` +
            "Опишите операцию обычным текстом, например:\n" +
            "Купил мясо домой два дня назад за 2000 рублей",

        askCategory: "",
        askDate: "",
        askNote: "",

        invalidAmount:
            "Некорректный формат.\n\n" +
            "Введите операцию так:\n" +
            "1500 salary\n\n" +
            "Или с датой и примечанием:\n" +
            "1500 категория YYYY-MM-DD примечание\n\n" +
            "Или введите /cancel для отмены.",

        invalidDate:
            "Некорректный формат даты.\n\n" +
            "Введите дату так:\n" +
            "YYYY-MM-DD",

        emptyCategory: "Категория не может быть пустой.",
        noActiveFlow: "Нет активной операции для отмены.",
        cancelled: "Текущая операция отменена.",

        activeFlowWarning:
            "Сейчас у вас есть незавершённое добавление операции.\n\n" +
            "Введите операцию одной строкой или нажмите Отмена.",

        dataError: "Произошла ошибка в данных операции. Начните заново.",
        readUserError: "Не удалось прочитать данные пользователя.",
        cancelButton: "❌ Отмена",
    },
    naturalTransaction: {
        aiNotConfigured: "AI parsing is not configured yet.",
        parseFailed: "Не удалось разобрать сообщение. Попробуйте ещё раз чуть позже.",
        notDetected:
            "Я не смог распознать финансовую операцию в этом сообщении. Например: купил продукты домой за 500 рублей",
        askScope: "Эта операция личная или семейная?",
        saved: "✅ Операция сохранена:",
        noScopeSession: "Нет операции, ожидающей выбора области.",
    },
    receipt: {
        receiptFound: "🧾 Чек найден",
        receiptDate: "Дата",
        receiptTotal: "Итого",
        receiptTransactionsToCreate: "Будут созданы операции",
        receiptSaveQuestion: "Сохранить операции?",
        receiptSaveButton: "✅ Сохранить",
        receiptCancelButton: "❌ Отменить",
        receiptSaved: "✅ Операции из чека сохранены.",
        receiptAlreadySaved: "Этот чек уже был сохранён.",
        receiptCancelled: "Импорт чека отменён.",
        receiptCouldNotImport: "Не удалось импортировать этот чек. Попробуйте позже.",
        receiptAiNotConfigured: "AI-группировка чека не настроена.",
        receiptNoItems: "В чеке не найдены позиции.",
        groupedTotalDiffers: "⚠️ Сумма групп отличается от итога чека.",
        receiptChooseScopeAndConfirmAmount: "Выберите область расхода и подтвердите, что сумма верная:",
        receiptCurrentScope: "Область",
        qrImageProcessing: "Читаю QR-код с изображения...",
        qrImageDecodeFailed: "Не удалось прочитать QR-код. Попробуйте отправить фото ближе к QR-коду, без бликов и размытия, или отправьте изображение как файл.",
        qrImageUnsupportedFile: "Этот файл не является поддерживаемым изображением.",
        receiptExpenseOnly: "Чеки поддерживаются только для расходов. Отмените режим дохода или выберите тип расхода.",
    },
    voice: {
        voiceDisabled: "Голосовой ввод сейчас отключён.",
        voiceTranscribing: "Распознаю голосовое сообщение...",
        voiceTranscriptionFailed: "Не удалось распознать голосовое сообщение. Попробуйте записать его чётче.",
        voiceRecognizedText: (text: string) => `Я распознал:\n${text}`,
    },

    delete: {
        confirmation: "Вы уверены, что хотите удалить последнюю операцию?",
        deleteReceiptConfirm: (count: number) =>
            `Последняя операция относится к чеку. Удалить все операции из этого чека? Количество: ${count}`,
        deleteReceiptSuccess: (count: number) =>
            `Удалены все операции из последнего чека: ${count}`,
        deleteReceiptAlreadyDeleted: "Этот чек уже был удалён.",
        deleteReceiptFailed: "Не удалось удалить операции из чека.",
        confirmButton: "Да, удалить",
        cancelButton: "Отмена",
        cancelled: "Удаление отменено.",
        deletedSuccessfully: (type: string) => `Последняя операция удалена: ${type}`,
        amount: "Сумма",
        category: "Категория",
        date: "Дата",
        readUserError: "Не удалось прочитать данные пользователя.",
    },
    manualTransaction: {
        incomeUsage:
            "Используйте команду дохода так:\n" +
            "/income 1500 salary\n" +
            "/income 1500 salary 2026-05-05 bonus\n\n" +
            "Или короткий вариант:\n" +
            "+ 1500 salary\n" +
            "+ 1500 salary 2026-05-05 bonus",

        expenseUsage:
            "Используйте команду расхода так:\n" +
            "/expense 250 food\n" +
            "/expense 250 food 2026-05-05 lunch\n\n" +
            "Или короткий вариант:\n" +
            "- 250 food\n" +
            "- 250 food 2026-05-05 lunch",

        shortcutUsage:
            "Используйте короткий формат так:\n" +
            "+ 1500 salary\n" +
            "- 250 food\n\n" +
            "Можно также добавить дату и примечание:\n" +
            "+ 1500 salary 2026-05-05 bonus\n" +
            "- 250 food 2026-05-05 lunch",

        readUserError: "Не удалось прочитать данные пользователя.",
        unexpectedError: "Произошла непредвиденная ошибка.",
    },
    help: {
    text: (currency: string) =>
        `
        👋 Добро пожаловать в SmartSpendBot

        SmartSpendBot помогает вести учёт доходов и расходов, смотреть отчёты, историю операций и экспортировать отчёты в Excel.

        💬 Быстрое добавление текстом:
        Можно писать обычным текстом, бот сам попробует понять сумму, тип операции, категорию, дату и заметку.

        Примеры:
        + 1500 работа
        - 250 еда
        получил 3000 за урок с Марией 17-05-2026
        ярче продукты 2026-05-01 1233
        впн 141 16-05-2026

        📅 Даты:
        Можно писать дату в формате:
        17-05-2026
        17.05.2026
        17/05/2026
        2026-05-17
        2026.05.17
        2026/05/17

        Если дата не указана, бот использует сегодняшний день.

        💰 Ручной ввод:
        Через меню "Ручной ввод" можно добавить:
        • доход
        • личный расход
        • семейный расход

        Если в настройках выбран режим только личных или только семейных расходов, бот не будет каждый раз спрашивать тип расхода.

        🧾 Чеки и QR:
        Можно отправить QR-код чека текстом или фотографией.
        Бот попробует прочитать чек, сгруппировать покупки, показать предварительный просмотр и сохранить операции только после подтверждения.

        📊 Отчёты:
        Можно получить:
        • отчёт за сегодня
        • отчёты по месяцам
        • отчёт за выбранный вручную период

        В разделе "Другие отчёты" бот показывает месяцы, где есть операции, а также кнопку выбора периода вручную.

        📊 Excel:
        Под каждым отчётом есть кнопка "Скачать Excel".
        Файл содержит операции за выбранный месяц или период:
        • дата
        • тип
        • личный/семейный расход
        • сумма
        • категория
        • заметка
        • дата создания

        🧾 История:
        История показывает месяцы, в которых есть операции.
        После выбора месяца бот покажет операции за этот месяц.

        🗑 Удаление:
        Можно удалить последнюю операцию после подтверждения.
        Если последняя операция была создана из чека, бот удалит все операции этого чека вместе.

        ⚙️ Настройки:
        Можно изменить:
        • язык
        • валюту
        • режим расходов: разделять личные и семейные / только личные / только семейные

        Текущая валюта: ${currency}
        `.trim(),
    },
    menu: {
      addIncome: "➕ Добавить доход",
      addExpense: "➖ Добавить расход",
      addFamilyExpense: "🏠 Добавить семейный расход",
      addPersonalExpense: "👤 Добавить личный расход",
      manualEntry: "✍️ Ручной ввод",
      backToMainMenu: "⬅️ Главное меню",
      chooseOperationType: "Выберите тип операции:",
      reportAll: "📊 Общий отчёт",
      reportDay: "📅 Отчёт за день",
      reportWeek: "📆 Отчёт за неделю",
      reportMonth: "🗓 Отчёт за месяц",
      reportYear: "📈 Отчёт за год",
      history: "🧾 Последние операции",
      help: "ℹ️ Помощь",
      deleteLast: "🗑 Удалить последнюю",
      language: "🌐 Язык / Language",
      currency: "💱 Валюта",
      expenseModeSettingsButton: "👥 Тип расходов",
      timezoneSettings: "🌍 Часовой пояс",
      moreReports: "📊 Другие отчёты",
      settings: "⚙️ Настройки",
    },
  },

  en: {
    common: {
        readUserError: "Could not read user data.",
        unexpectedError: "Unexpected error occurred.",
        actionCancelled: "Action cancelled.",
    },
    start: {
      chooseLanguage: "Choose language:",
      welcome:
        "Welcome 👋\n" +
        "You have been registered in the expense tracker bot.\n\n" +
        "Use the buttons below or type /help to view available commands.",
    },
    language: {
      selected: "English selected ✅",
      ready: "You can now use the bot from the menu.",
      unsupported: "Unsupported language.",
    },
    currency: {
        choose: "Choose the currency you want to use:",
        selected: (currency: string) => `Currency selected: ${currency} ✅`,
        customButton: "Custom currency",
        customPrompt:
            "Enter the currency you want to use.\n\n" +
            "Examples:\n" +
            "USDT\n" +
            "BYN\n" +
            "₽\n" +
            "$",
        invalidCustom:
            "Invalid currency.\n" +
            "Enter a short currency symbol/code, for example USD, RUB, or ₽.",
    },
    expenseScopeMode: {
        question: "How do you want to track expenses?",
        separate: "👥 Separate personal and family",
        personalOnly: "👤 All expenses are personal",
        familyOnly: "🏠 All expenses are family",
        updated: "Expense mode updated.",
        fixedBySettings: "Expense scope is fixed by settings.",
    },
    timezone: {
        choose: "Choose timezone:",
        updated: (timezone: string) => `Timezone updated: ${timezone}`,
    },
    report: {
        titles: {
        all: "📊 Full report",
        day: "📊 Today's report",
        week: "📊 This week's report",
        month: "📊 This month's report",
        year: "📊 This year's report",
        },
        totalIncome: "Total income",
        totalExpense: "Total expense",
        balance: "Balance",
        transactionCount: "Transaction count",
        incomeSection: "📈 Income:",
        personalExpenseSection: "📉 Personal expenses:",
        familyExpenseSection: "🏠 Family expenses:",
        total: "Total",
        noItems: "No transactions.",
        customRangeButton: "📅 Custom period",
        customRangeFromQuestion: "From which date? Write the date like this: 22-05-2026",
        customRangeToQuestion: "To which date? Write the date like this: 29-05-2026",
        invalidDate: "Invalid date. Write the date like this: 22-05-2026",
        endDateBeforeStartDate: "End date must be after or equal to start date.",
        customTitle: (from: string, to: string) => `📊 Report from ${from} to ${to}:`,
        excelButton: "📊 Download Excel",
        excelPreparing: "Preparing Excel file...",
        excelNoTransactions: "No transactions in this period.",
        waitingForDateInput: "I am waiting for a report date. Write a date like 22-05-2026 or send “Cancel”.",
    },
    transaction: {
        type: "Type",
        income: "Income",
        expense: "Expense",
        scope: "Scope",
        personalScope: "personal",
        familyScope: "family",
        scopePersonal: "personal",
        scopeFamily: "family",
        amount: "Amount",
        category: "Category",
        date: "Date",
        note: "Note",
        createdSuccessfully: (type: string) => `✅ ${type} added successfully`,
        },

        history: {
        titles: {
            recent: (count: number) => `🧾 Last ${count} transactions`,
            date: (date: string) => `🧾 Transactions for ${date}`,
            month: (month: string) => `🧾 Transactions for ${month}`,
            day: "🧾 Today's transactions",
            week: "🧾 This week's transactions",
            year: "🧾 This year's transactions",
        },
        empty: "There are no transactions in this period.",
        noTransactionsYet: "No transactions yet.",
        noTransactionsInMonth: "No transactions in this month.",
        chooseReportMonth: "Choose a month for the report:",
        chooseHistoryMonth: "Choose a month to view transactions:",
        previousPage: "Previous",
        nextPage: "Next",
        page: (page: number, totalPages: number) => `Page ${page} of ${totalPages}`,
        invalidUsage:
            "Use the command like this:\n" +
            "/history\n" +
            "/history 10\n" +
            "/history 2026-05-04",
    },
    transactionFlow: {
        start: (type: string) =>
            `Okay, let's add ${type}.\n\n` +
            "Write the transaction naturally, for example:\n" +
            "Bought groceries for home two days ago for 2000 rubles",

        askCategory: "",
        askDate: "",
        askNote: "",

        invalidAmount:
            "Invalid format.\n\n" +
            "Write the transaction like this:\n" +
            "1500 salary\n\n" +
            "Or with date and note:\n" +
            "1500 salary YYYY-MM-DD bonus\n\n" +
            "Or type /cancel to cancel.",

        invalidDate:
            "Invalid date format.\n\n" +
            "Write the date like this:\n" +
            "YYYY-MM-DD",

        emptyCategory: "Category cannot be empty.",
        noActiveFlow: "There is no active transaction to cancel.",
        cancelled: "The current transaction has been cancelled.",

        activeFlowWarning:
            "You already have an active transaction flow.\n\n" +
            "Write the transaction in one line or press Cancel.",

        dataError: "There was an error in the transaction data. Please start again.",
        readUserError: "Could not read user data.",
        cancelButton: "❌ Cancel",
    },
    naturalTransaction: {
        aiNotConfigured: "AI parsing is not configured yet.",
        parseFailed: "I could not parse that message right now. Please try again shortly.",
        notDetected:
            "I could not detect a financial transaction in this message. For example: bought groceries for home for 500 rubles",
        askScope: "Is this transaction personal or family?",
        saved: "✅ Transaction saved:",
        noScopeSession: "There is no transaction waiting for scope confirmation.",
    },
    receipt: {
        receiptFound: "🧾 Receipt found",
        receiptDate: "Date",
        receiptTotal: "Total",
        receiptTransactionsToCreate: "Transactions to create",
        receiptSaveQuestion: "Save transactions?",
        receiptSaveButton: "✅ Save",
        receiptCancelButton: "❌ Cancel",
        receiptSaved: "✅ Receipt transactions saved.",
        receiptAlreadySaved: "This receipt was already saved.",
        receiptCancelled: "Receipt import cancelled.",
        receiptCouldNotImport: "I could not import this receipt. Please try again later.",
        receiptAiNotConfigured: "Receipt AI grouping is not configured.",
        receiptNoItems: "No receipt items were found.",
        groupedTotalDiffers: "⚠️ The grouped total differs from receipt total.",
        receiptChooseScopeAndConfirmAmount: "Choose expense scope and confirm that the amount is correct:",
        receiptCurrentScope: "Scope",
        qrImageProcessing: "Reading QR code from the image...",
        qrImageDecodeFailed: "I couldn't read the QR code. Try sending a closer photo without glare or blur, or send the image as a file.",
        qrImageUnsupportedFile: "This file is not a supported image.",
        receiptExpenseOnly: "Receipts are supported only for expenses. Please cancel income mode or choose an expense type.",
    },
    voice: {
        voiceDisabled: "Voice input is currently disabled.",
        voiceTranscribing: "Transcribing voice message...",
        voiceTranscriptionFailed: "I couldn't understand the voice message. Try recording it more clearly.",
        voiceRecognizedText: (text: string) => `I recognized:\n${text}`,
    },
    delete: {
        confirmation: "Are you sure you want to delete the last transaction?",
        deleteReceiptConfirm: (count: number) =>
            `The last transaction belongs to a receipt. Delete all transactions from this receipt? Count: ${count}`,
        deleteReceiptSuccess: (count: number) =>
            `Deleted all transactions from the last receipt: ${count}`,
        deleteReceiptAlreadyDeleted: "This receipt was already deleted.",
        deleteReceiptFailed: "Could not delete receipt transactions.",
        confirmButton: "Yes, delete",
        cancelButton: "Cancel",
        cancelled: "Deletion cancelled.",
        deletedSuccessfully: (type: string) => `Last ${type} deleted`,
        amount: "Amount",
        category: "Category",
        date: "Date",
        readUserError: "Could not read user data.",
    },
    manualTransaction: {
        incomeUsage:
            "Use the income command like this:\n" +
            "/income 1500 salary\n" +
            "/income 1500 salary 2026-05-05 bonus\n\n" +
            "Or use the shortcut:\n" +
            "+ 1500 salary\n" +
            "+ 1500 salary 2026-05-05 bonus",

        expenseUsage:
            "Use the expense command like this:\n" +
            "/expense 250 food\n" +
            "/expense 250 food 2026-05-05 lunch\n\n" +
            "Or use the shortcut:\n" +
            "- 250 food\n" +
            "- 250 food 2026-05-05 lunch",

        shortcutUsage:
            "Use the shortcut like this:\n" +
            "+ 1500 salary\n" +
            "- 250 food\n\n" +
            "You can also add a date and note:\n" +
            "+ 1500 salary 2026-05-05 bonus\n" +
            "- 250 food 2026-05-05 lunch",

        readUserError: "Could not read user data.",
        unexpectedError: "Unexpected error occurred.",
    },
    help: {
        text: (currency: string) =>
            `
        👋 Welcome to SmartSpendBot

        SmartSpendBot helps you track income and expenses, view reports, review history, and export reports to Excel.

        💬 Quick text entry:
        You can write a transaction in normal text. The bot will try to understand the amount, type, category, date, and note.

        Examples:
        + 1500 work
        - 250 food
        received 3000 for a lesson with Maria 17-05-2026
        ярче продукты 2026-05-01 1233
        vpn 141 16-05-2026

        📅 Dates:
        You can write dates in these formats:
        17-05-2026
        17.05.2026
        17/05/2026
        2026-05-17
        2026.05.17
        2026/05/17

        If no date is provided, the bot uses today.

        💰 Manual entry:
        From "Manual entry" you can add:
        • income
        • personal expense
        • family expense

        If your settings use personal-only or family-only mode, the bot will not ask for the expense type every time.

        🧾 Receipts and QR:
        You can send a receipt QR code as text or as an image.
        The bot will try to read the receipt, group items, show a preview, and save transactions only after your confirmation.

        📊 Reports:
        You can view:
        • today's report
        • monthly reports
        • custom date range reports

        In "More reports", the bot shows months that contain transactions and a custom period button.

        📊 Excel:
        Under every report there is a "Download Excel" button.
        The file contains transactions for the same month or date range:
        • date
        • type
        • personal/family scope
        • amount
        • category
        • note
        • created at

        🧾 History:
        History shows months that contain transactions.
        After choosing a month, the bot shows transactions for that month.

        🗑 Delete:
        You can delete the last transaction after confirmation.
        If the last transaction was created from a receipt, the bot deletes the whole receipt group together.

        ⚙️ Settings:
        You can change:
        • language
        • currency
        • expense mode: separate personal/family / personal only / family only

        Current currency: ${currency}
        `.trim(),
    },
    menu: {
      addIncome: "➕ Add income",
      addExpense: "➖ Add expense",
      addFamilyExpense: "🏠 Add family expense",
      addPersonalExpense: "👤 Add personal expense",
      manualEntry: "✍️ Manual entry",
      backToMainMenu: "⬅️ Main menu",
      chooseOperationType: "Choose operation type:",
      reportAll: "📊 Full report",
      reportDay: "📅 Day report",
      reportWeek: "📆 Week report",
      reportMonth: "🗓 Month report",
      reportYear: "📈 Year report",
      history: "🧾 Recent transactions",
      help: "ℹ️ Help",
      deleteLast: "🗑 Delete last",
      language: "🌐 Language",
      currency: "💱 Currency",
      expenseModeSettingsButton: "👥 Expense mode",
      timezoneSettings: "🌍 Timezone",
      moreReports: "📊 More reports",
      settings: "⚙️ Settings",
    },
  },
};

export function getMessages(language?: SupportedLanguage): Messages {
  return translations[language ?? defaultLanguage];
}
