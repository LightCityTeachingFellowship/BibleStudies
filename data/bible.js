﻿var bible = {};
bible.Data = {};
bible.Data.books = [
["GENESIS","GEN","GE","GN"],
["EXODUS","EXO","EX","EXOD"],
["LEVITICUS","LEV","LE","LV"],
["NUMBERS","NUM","NU","NM","NB"],
["DEUTERONOMY","DEU","DEUT","DT"],
["JOSHUA","JOSH","JOS","JSH"],
["JUDGES","JDG","JUDGE","JUDG","JG","JDGS"],
["RUTH","RTH","RU","RUT"],
["I SAMUEL","1SAM","1 SAMUEL","1SAMUEL","1ST SAMUEL","FIRST SAMUEL","1 SAM","1 SA","1S","I SA","1 SM","1SA","I SAM"],
["II SAMUEL","2SAM","2 SAMUEL","2SAMUEL","2ND SAMUEL","SECOND SAMUEL","2 SAM","2 SA","2S","II SA","2 SM","2SA","II SAM"],
["I KINGS","1KIN","1 KGS","1 KI","1K","I KGS","1KGS","I KI","1KI","I KING","1KINGS","1 KINGS","1 KING","1 KIN","1ST KGS","1ST KINGS","FIRST KINGS","FIRST KGS"],
["II KINGS","2KIN","2 KGS","2 KI","2K","II KGS","2KGS","II KI","2KI","II KING","2KINGS","2 KINGS","2 KING","2 KIN","2ND KGS","2ND KINGS","SECOND KINGS","SECOND KGS"],
["I CHRONICLES","1CHR","1 CHRON","1 CH","I CH","1CH","1 CHR","I CHR","1 CHR","I CHRON","1CHRON","1CHRONICLES","1 CHRONICLES","1ST CHRONICLES","FIRST CHRONICLES"],
["II CHRONICLES","2CHR","2 CHRON","2 CH","II CH","2CH","II CHR","2 CHR","II CHRON","2CHRON","2CHRONICLES","2 CHRONICLES","2ND CHRONICLES","SECOND CHRONICLES"],
["EZRA","EZR"],
["NEHEMIAH","NEH","NE"],
["ESTHER","EST","ESTH","ES"],
["JOB","JOB","JB"],
["PSALMS","PSA","PSALM","PSAL","PSLM","PS","PSM","PSS"],
["PROVERBS","PRO","PROV","PR","PRV"],
["ECCLESIASTES","ECC","ECCL","ECCLES","EC","QOH","QOHELETH"],
["SONG OF SOLOMON","SON","SOS","SONG OF SONGS","SONG","SO","CANTICLE OF CANTICLES","CANTICLES"],
["ISAIAH","ISA","IS"],
["JEREMIAH","JER","JERE","JE","JR"],
["LAMENTATIONS","LAM","LAMENTATION","LA"],
["EZEKIEL","EZE","EZEK","EZK","EZ"],
["DANIEL","DAN","DA","DN"],
["HOSHEA","HOSEA","HOS","HO"],
["JOEL","JOE","JL"],
["AMOS","AMO","AM"],
["OBADIAH","OBA","OBAD","OB"],
["JONAH","JON","JONA","JNH"],
["MICAH","MIC","MICA"],
["NAHUM","NAH","NAHU","NA"],
["HABAKKUK","HAB","HBK","HABA","HABAK"],
["ZEPHANIAH","ZEPH","ZEP","ZP"],
["HAGGAI","HAG","HAGG","HG"],
["ZECHARIAH","ZEC","ZECH","ZC"],
["MALACHI","MAL","MALA","ML","MLC","MALAC"],
["MATTHEW","MAT","MATHEW","MATT","MT"],
["MARK","MAR","MRK","MK","MR"],
["LUKE","LUK","LK"],
["JOHN","JOH","JN","JHN"],
["ACTS","ACT","AC"],
["ROMANS","ROM","RO","RM"],
["I CORINTHIANS","1COR","1CO","1 CO","I CO","I COR","1 COR","1CORINTHIANS","1 CORINTHIANS","1ST CORINTHIANS","FIRST CORINTHIANS"],
["II CORINTHIANS","2COR","2CO","2 COR","2 CO","II CO","II COR","2CORINTHIANS","2 CORINTHIANS","2 CORINTHIANS","2ND CORINTHIANS","SECOND CORINTHIANS"],
["GALATIANS","GAL","GA","GALATIAN"],
["EPHESIANS","EPH","EPHESIAN","EPHES"],
["PHILIPPIANS","PHP","PHILIP","PHILP","PHILI","PHIL"],
["COLOSSIANS","COL","COLO","COLOS"],
["I THESSALONIANS","1TH","1THE","1THES","1 TH","1 THE","1 THESS","I TH","I THE","I THES","I THESS","1THESS","1THESSALONIANS","1 THESSALONIANS","1ST THESSALONIANS","FIRST THESSALONIANS"],
["II THESSALONIANS","2TH","2THE","2THES","2 TH","2 THE","2 THESS","II TH","II THE","II THES","II THESS","2THESS","2THESSALONIANS","2 THESSALONIANS","2ND THESSALONIANS","SECOND THESSALONIANS"],
["I TIMOTHY","1TI","1TIM","1 TIM","1 TI","I TI","I TIM","1TIMOTHY","1 TIMOTHY","1ST TIMOTHY","FIRST TIMOTHY"],
["II TIMOTHY","2TI","2TIM","2 TIM","2 TI","II TI","II TIM","2TIMOTHY","2 TIMOTHY","2ND TIMOTHY","SECOND TIMOTHY"],
["TITUS","TIT","TITU"],
["PHILEMON","PHM","PHILE","PHILEM","PHILM"],
["HEBREWS","HEB"],
["JAMES","JAM","JAS","JM"],
["I PETER","1PE","1PET","1 PET","1 PE","I PE","I PET","I PT","1 PT","1PT","1PETER","1 PETER","1ST PETER","FIRST PETER"],
["II PETER","2PE","2PET","2 PET","2 PE","II PE","II PET","II PT","2 PT","2PT","2PETER","2 PETER","2ND PETER","SECOND PETER"],
["I JOHN","1JOH","1 JOHN","1 JN","I JN","1JN","I JO","1JO","I JOH","1 JOH","I JHN","1 JHN","1JHN","1JOHN","1 JOHN","1ST JOHN","FIRST JOHN"],
["II JOHN","2JOH","2 JOHN","2 JN","II JN","2JN","II JO","2JO","II JOH","2 JOH","II JHN","2 JHN","2JHN","2JOHN","2 JOHN","2ND JOHN","SECOND JOHN"],
["III JOHN","3JOH","3 JOHN","3 JN","III JN","3JN","III JO","3JO","III JOH","3 JOH","III JHN","3 JHN","3JHN","3JOHN","3 JOHN","3RD JOHN","THIRD JOHN"],
["JUDE","JUD"],
["REVELATION","REV","RE","THE REVELATION"]
];
//TODO - use the arrays above
bible.Data.otBooks = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','I Samuel','II Samuel','I Kings','II Kings','I Chronicles','II Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi'];
bible.Data.ntBooks = ['Matthew','Mark','Luke','John','Acts','Romans','I Corinthians','II Corinthians','Galatians','Ephesians','Philippians','Colossians','I Thessalonians','II Thessalonians','I Timothy','II Timothy','Titus','Philemon','Hebrews','James','I Peter','II Peter','I John','II John','III John','Jude','Revelation'];
bible.Data.allBooks = bible.Data.otBooks.concat( bible.Data.ntBooks );
bible.Data.bookNamesByLanguage = {
	"en":["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","I Samuel","II Samuel","I Kings","II Kings","I Chronicles","II Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","I Corinthians","II Corinthians","Galatians","Ephesians","Philippians","Colossians","I Thessalonians","II Thessalonians","I Timothy","II Timothy","Titus","Philemon","Hebrews","James","I Peter","II Peter","I John","II John","III John","Jude","Revelation"],
	"fa":["پدایش","خروج","لاویان","اعداد","تشنیه","یوشع","داوران","روت","اول سموییل","دوم سموییل","اول پادشاهان","دوم پادشاهان","اول تواریخ","دوم تواریخ","عزرا","نحمیا","استر","ایوب","مزامیر","امثال","جامعه","غزل غزلها","اشعیا","ارمیا","مراثی ارمیا","حزقیال","دانیال","هوشع","یوییل","عاموس","عوبدیا","یونس","میکاه","ناحوم","حبقوق","صفنیا","حخی","زکریا","ملاکی","متی","مرقس","لوقا","یوحنا","اعمال رسولان","رومیان","اول قرنتیان","دوم قرنتیان","علاطیان","افسیان","فلیپیان","کولسیان","اول تسالونیکیان","دوم تسالونیکیان","اول تیموتایوس","دوم تیموتایوس","تیطوس","فلیمون","عبرانیان","یعقوب","اول پطرس","دوم پطرس","اول یحنا","دوم یحنا","سوم یحانا","یهودا","مکاشفه"],
	"fr":["Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther","Job","Psaumes","Proverbes","Ecclésiaste","Cantique des Cantiques","Ésaïe","Jérémie","Lamentations","Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahum","Habacuc","Sophonie","Aggée","Zacharie","Malachie","Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude","Apocalypse"],
	"original":["בראשית","שמות","ויקרא","במדבר","דברים","יהושע","שפטים","רות","שמואל א","שמואל ב","מלכים א","מלכים ב","דברי הימים א","דברי הימים ב","עזרא","נחמיה","אסתר","איוב","תהילים","משלי","קהלת","שיר השירים","ישעה","ירמיה","איכה","יחזקאל","דניאל","הושע","יואל","עמוס","עבדיה","יונה","מיכה","נחום","חבקוק","צפניה","חגי","זכריה","מלאכי","Ματθαίος","Μαρκος","Λουκας","Ιωαννης","Πραξεις","Ρωμαιους","Α Κορινθίους","Β Κορινθίους","Γαλατες","Εφεσιους","Φιλιππησιους","Κολοσσαεις","Α Θεσσαλονικεις","Β Θεσσαλονικεις","Α Τιμοθεο","Β Τιμοθεο","Τιτο","Φιλημονα","Εβραιους","Ιακωβου","Α Πετρου","Β Πετρου","Α Ιωαννη","Β Ιωαννη","Γ Ιωαννη","Ιουδα","Αποκαλυψη του Ιωαννη"],
	'ar':['تكوين','خروج','لاويين','عدد','تثنية','يشوع','قضاة','راعوث','1 صموئيل','2 صموئيل','1 ملوك','2 ملوك','1 اخبار','2 اخبار','عزرا','نحميا','استير','ايوب','مزامير','امثال','جامعة','نشيد الانشاد','اشعياء','ارميا','مراثي','حزقيال','دانيال','هوشع','يوئيل','عاموس','عوبديا','يونان','ميخا','ناحوم','حبقوق','صفنيا','حجى','زكريا','ملاخي','متى','مرقس','لوقا','يوحنا','اعمال','رومية','1 كورنثوس','2 كورنثوس','غلاطية','افسس','فيلبي','كولوسي','1 تسالونيكي','2 تسالونيكي','1 تيموثاوس','2 تيموثاوس','تيطس','فليمون','عبرانيين','يعقوب','1بطرس','2بطرس','1 يوحنا','2 يوحنا','3 يوحنا','يهوذا','رؤيا'],
	'ro':['Geneza','Exodul','Leviticul','Numeri','Deuteronom','Iosua','Judecători','Rut','1 Samuel','2 Samuel','1 Regi','2 Regi','1 Cronici','2 Cronici','Ezra','Neemia','Estera','Iov','Psalmii','Proverbe','Eclesiastul','Cântarea Cântărilor','Isaia','Ieremia','Plângeri','Ezechiel','Daniel','Osea','Ioel','Amos','Obadia','Iona','Mica','Naum','Habacuc','Ţefania','Hagai','Zaharia','Maleahi','Matei','Marcu','Luca','Ioan','Faptele Apostolilor','Romani','1 Corintieni','2 Corintieni','Galateni','Efeseni','Filipeni','Coloseni','1 Tesaloniceni','2 Tesaloniceni','1 Timotei','2 Timotei','Titus','Filimon','Evrei','Iacov','1 Petru','2 Petru','1 Ioan','2 Ioan','3 Ioan','Iuda','Apocalipsa'],
	'hlt':['Suencuek','Sunglatnah','Thothuengnah','Lampahnah','Olrhaep','Joshua','Laitloekkung','Ruth','1 Samuel','2 Samuel','1 Manghai','2 Manghai','1 Khokhuen','2 Khokhuen','Ezra','Nehemiah','Esther','Job','Tingtoeng','Olcueih','Thuituen','Solomon Laa','Isaiah','Jeremiah','Rhaengsae','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malakhi','Matthai','Marku','Luka','Johan','Caeltueih','Rom','1 Khawrin','2 Khawrin','Galati','Ephisa','Philipi','Kolosa','1 Thesalonika','2 Thesalonika','1 Timothy','2 Timothy','Titu','Philimon','Hebru','Jame','1 Peter','2 Peter','1 Johan','2 Johan','3 Johan','Jude','Olphong'],
	'ckb':['پەیدابوون','دەرچوون','لێڤییەکان','سه‌رژمێری','دواوتار','یەشوع','ڕابەران','ڕائووس','یەکەم ساموئێل','دووەم ساموێل','یەکەم پاشایان','دووەم پاشایان','یەکەم پوختەی مێژوو','دووەم پوختەی مێژوو','عەزرا','نەحەمیا','ئەستەر','ئەیوب','زەبوورەکان','پەندەکانی سلێمان','ژیرمه‌ندی','گۆرانی گۆرانییه‌كان','ئیشایا','یه‌رمیا','شینه‌كانی یه‌رمیا','حزقیێل','دانیال','هۆشه‌ع','یۆئێل','ئامۆس','عۆبه‌دیا','یونس','میخا','ناحوم','حه‌به‌قوق','سه‌فه‌نیا','حه‌گه‌ی','زه‌كه‌ریا','مه‌لاخی','مەتا','مەرقۆس','لۆقا','یۆحەنا','کردار','ڕۆما','١ کۆرنسۆس','٢ کۆرنسۆس','گەلاتیا','ئەفەسۆس','فیلیپی','کۆلۆسی','١ سالۆنیكی','٢ سالۆنیكی','١ تیمۆساوس','٢ تیمۆساوس','تیتۆس','فلیمۆن','عیبرانییەکان','یاقوب','١ پەترۆس','٢ پەترۆس','١ یۆحەنا','٢ یۆحەنا','٣ یۆحەنا','یەهوزا','ئاشکراکردن'],
	'yrb':["Gẹ́nẹ́sísì","Ékísódù","Léfítíkù","Numeri","Deuteronomi","Josua","Awọn Onidajọ","Ruutu","Samueli (Kinni)","Samueli (Keji)","Awon Ọba (Kinni)","Awon Ọba (Keji)","Kronika (Kinni)","Kronika (Keji)","Esra","Nehemiah","Esteri","Jobu","Psalmu","Òwe","Oniwasu","Orin Solomọni","Isaiah","Jeremiah","Ẹkún Jeremiah","Esekieli","Danieli","Hosea","Joeli","Amọsi","Obadiah","Jonà","Mika","Nahumu","Habakkuku","Sefaniah","Haggai","Sekariah","Malaki","Matteu","Marku","Luku","Johanu","Ise Awọn Aposteli","Awọn Ará Romu","Awọn Ará Korinti (Kinni)","Awọn Ará Korinti (Keji)","Awọn Ará Galatia","Awọn Ará Efesu","Awọn Ará Filippi","Awọn Ará Kolosse","Awọn Ará Tessalonika (Kinni)","Awọn Ará Tessalonika (Keji)","Timoteu (Kinni)","Timoteu (Keji)","Titu","Filimọni","Awọn Heberu","Jákọ́bù","Peteru (Kinni)","Peteru (Keji)","Johanu (Kinni)","Johanu (Keji)","Johanu (Kẹta)","Juda","Ifihan"
	]
};
bible.Data.rtlLanguages = [ 'he', 'fa', 'ar', 'ckb' ];
bible.Data.supportedVersions = {
	'original': { name: 'Original', language: 'original', withStrongsNums:true },
	'accented': { name: 'Accented original', language: 'original', withStrongsNums:true },
	'KJV': { name: 'King James Version', language: 'en', withStrongsNums:true },
	'ABP-en': { name: 'Apostolic Bible Polyglot-en', language: 'en', withStrongsNums:true },
	'ABP-gr': { name: 'Apostolic Bible Polyglot-gr', language: 'gr', withStrongsNums:true },
	'WEB': { name: 'World English Bible', language: 'en', withStrongsNums:true },
	'ESV': { name: 'English Standard Version', language: 'en', withStrongsNums:true },
	'LC': { name: 'Literal Consistent', language: 'en', withStrongsNums:false },
	'YLT': { name: 'Young\'s Literal Translation', language: 'en', withStrongsNums:false },
	'ASV': { name: 'American Standard Version', language: 'en', withStrongsNums:false },
	'DARBY': { name: 'Darby Translation', language: 'en', withStrongsNums:false },
	'GW': { name: 'God\'s Word Translation', language: 'en', withStrongsNums:false },
	'JUB': { name: 'Jubilee Bible 200', language: 'en', withStrongsNums:false },
	'LEB': { name: 'Lexham English Bible', language: 'en', withStrongsNums:false },
	'NIV’84': { name: 'New International Translation', language: 'en', withStrongsNums:false },
	'NET': { name: 'New English Translation', language: 'en', withStrongsNums:false },
	'WMB': { name: 'World Messianic Bible', language: 'en', withStrongsNums:false },
	'OPV': { name: 'ترجمه-ی قدام', language: 'fa', withStrongsNums:false },
	'TPV': { name: 'مژده برای اسرع جدید', language: 'fa', withStrongsNums:false },
	'NMV': { name: 'ترجمه هزارۀ نو', language: 'fa', withStrongsNums:false },
	'AraSVD': { name: 'Arabic Bible', language: 'ar', withStrongsNums:false },
	'RomCor': { name: 'Cornilescu Bible in Romanian language', language: 'ro', withStrongsNums:false },
	'MCSB': { name: 'Matupi Chin Standard Bible', language: 'hlt', withStrongsNums:true },
	'FreSegond1910': { name: "Bible Louis Segond (1910)", language: 'fr', withStrongsNums:false },
	'FreJND': { name: "Bible J.N.Darby en français", language: 'fr', withStrongsNums:false },
	'FrePGR': { name: "Bible Perret-Gentil et Rilliet", language: 'fr', withStrongsNums:false },
	'CKBOKS': { name: "وەشانی بێبەرامبەری کوردیی سۆرانیی ستاندەر", language: 'ckb', withStrongsNums:false },
	'Yoruba': { name: "Yoruba Bible", language: 'yrb', withStrongsNums:false },
	// 'GRKV': { name: "Greek LXX and NT-TR", language: 'gr', withStrongsNums:false },
};
bible.Data.interfaceLanguages = {
	'original': 'Hebrew/Greek',
	'en': 'English',
	'fa': 'Farsi',
	'ro': 'Romanian',
	'ar': 'Arabic',
	'hlt': 'Matupi Chin',
	'fr': 'French',
	'ckb': 'Kurdi Sorani',
	'gr': 'Greek',
	'yrb': 'Yoruba',
};

bible.Data.verses = [
[31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26],
[22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38],
[17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34],
[54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13],
[46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12],
[18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33],
[36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25],
[22,23,18,22],
[28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13],
[27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25],
[53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53],
[18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30],
[54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30],
[17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23],
[11,70,13,24,17,22,28,36,15,44],
[11,20,32,23,19,19,73,18,38,39,36,47,31],
[22,23,15,17,14,14,10,17,32,3],
[22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17],
[6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6],
[33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31],
[18,26,22,16,20,12,29,17,18,20,10,14],
[17,17,11,16,16,13,13,14],
[31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24],
[19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34],
[22,22,66,22,22],
[28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35],
[21,49,30,37,31,28,28,27,27,21,45,13],
[11,23,5,19,15,11,16,14,17,15,12,14,16,9],
[20,32,21],
[15,16,15,13,27,14,17,14,15],
[21],
[17,10,10,11],
[16,13,12,13,15,16,20],
[15,13,19],
[17,20,19],
[18,15,20],
[15,23],
[21,13,10,14,11,15,14,23,17,12,17,14,9,21],
[14,17,18,6],
[25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20],
[45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20],
[80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53],
[51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25],
[26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31],
[32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27],
[31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24],
[24,17,18,18,21,18,16,24,15,18,33,21,14],
[24,21,29,31,26,18],
[23,22,21,32,33,24],
[30,30,21,23],
[29,23,25,18],
[10,20,13,18,28],
[12,17,18],
[20,15,16,16,25,21],
[18,26,17,22],
[16,15,15],
[25],
[14,18,19,16,14,20,28,13,28,39,40,29,25],
[27,26,18,17,20],
[25,25,22,19,14],
[21,22,18],
[10,29,24,21,21],
[13],
[14],
[25],
[20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21]
];

bible.parseReference = function(textReference) {

	var bookID = -1;
	var chapter1 = -1;
	var verse1 = -1;
	var chapter2 = -1;
	var verse2 = -1;
	var input = new String(textReference);

	bookID = bible.getBookId( input )

	var afterRange = false;
	var afterSeparator = false;
	var startedNumber = false;
	var currentNumber = '';

	for (var i = 0; i < input.length; i++) {
		var c = input.charAt(i);

		if (c == ' ' || isNaN(c)) {
			if (!startedNumber)
				continue;

			if (c == '-') {
				afterRange = true;
				afterSeparator = false;
			} else if (c == ':' || c == ',' || c == '.') {
				afterSeparator = true;
			} else {
				// ignore
			}

			// reset
			currentNumber = '';
			startedNumber = false;

		} else {
			startedNumber = true;
			currentNumber += c;

			if (afterSeparator) {
				if (afterRange) {
					verse2 = parseInt(currentNumber);
				} else { // 1:1
					verse1 = parseInt(currentNumber);
				}
			} else {
				if (afterRange) {
					chapter2 = parseInt(currentNumber);
				} else { // 1
					chapter1 = parseInt(currentNumber);
				}
			}
		}
	}

	// reassign 1:1-2
	if (chapter1 > 0 && verse1 > 0 && chapter2 > 0 && verse2 <= 0) {
		verse2 = chapter2;
		chapter2 = chapter1;
	}
	// fix 1-2:5
	if (chapter1 > 0 && verse1 <= 0 && chapter2 > 0 && verse2 > 0) {
		verse1 = 1;
	}

	// just book
	if (bookID > 0 && chapter1 <= 0 && verse1 <= 0 && chapter2 <= 0 && verse2 <= 0) {
		chapter1 = 1;
		verse1 = 1;
	}

	// validate max chapter
	if (chapter1 == -1) {
		chapter1 = 1;
	} else if (chapter1 > bible.Data.verses[bookID - 1].length) {
		chapter1 = bible.Data.verses[bookID - 1].length;
		verse1 = 1;
	}

	// validate max verse
	if (verse1 == -1) {
		verse1 = 1;
	} else if (verse1 > bible.Data.verses[bookID - 1][chapter1-1]) {
		verse1 = bible.Data.verses[bookID - 1][chapter1-1];
	}


	// finalize

	return new bible.Reference(bookID, chapter1, verse1, chapter2, verse2);
};

bible.Reference = function() {

	var _bookID = -1;
	var _chapter1 = -1;
	var _verse1 = -1;
	var _chapter2 = -1;
	var _verse2 = -1;

	if (arguments.length == 0) {
		// error
	} else if (arguments.length == 1) { // a string that needs to be parsed
		return bible.parseReference(arguments[0]);
	} else {
		_bookID = arguments[0];
		_chapter1 = arguments[1];
		if (arguments.length >= 3) _verse1 = arguments[2];
		if (arguments.length >= 4) _chapter2 = arguments[3];
		if (arguments.length >= 5) _verse2 = arguments[4];
	}

	function padLeft(input, length, s) {
		while (input.length < length)
			input = s + input;
		return input;
	}

	return {
		bookID: _bookID,
		bookName: bible.getBook( _bookID ),
		chapter: _chapter1,
		verse: _verse1,
		chapter1: _chapter1,
		verse1: _verse1,
		chapter2: _chapter2,
		verse2: _verse2,

		isValid: false,

		toString: function() {
			if (this.bookID < 1 || this.bookID > bible.Data.books.length) return "invalid";

			var b = bible.Data.books[this.bookID - 1][0] + ' ';

			if (this.chapter1 > 0 && this.verse1 <= 0 && this.chapter2 <= 0 && this.verse2 <= 0) // John 1
				return b + this.chapter1;
			else if (this.chapter1 > 0 && this.verse1 > 0 && this.chapter2 <= 0 && this.verse2 <= 0) // John 1:1
				return b + this.chapter1 + ':' + this.verse1;
			else if (this.chapter1 > 0 && this.verse1 > 0 && this.chapter2 <= 0 && this.verse2 > 0) // John 1:1-5
				return b + this.chapter1 + ':' + this.verse1 + '-' + this.verse2;
			else if (this.chapter1 > 0 && this.verse1 <= 0 && this.chapter2 > 0 && this.verse2 <= 0) // John 1-2
				return b + this.chapter1 + '-' + this.chapter2;
			else if (this.chapter1 > 0 && this.verse1 > 0 && this.chapter2 > 0 && this.verse2 > 0) // John 1:1-2:2
				return b + this.chapter1 + ':' + this.verse1 + '-' + ((this.chapter1 != this.chapter2) ? this.chapter2 + ':' : '') + this.verse2;
			else
				return 'unknown';
		},
		toOsis: function() {
			if (this.bookID <= 0 || this.bookID > bible.Data.books.length) return "invalid";
			return bible.Data.books[this.bookID - 1][0] + '.' + this.chapter1 + '.' + this.verse1;
		},
		toChapterCode: function() {
			if (this.bookID <= 0 || this.bookID > bible.Data.books.length) return "invalid";
			//return this.bookID.toString() + this.chapter1.toString()
			return 'c' + padLeft(this.bookID.toString(), 3, '0') + padLeft(this.chapter1.toString(), 3, '0');
		},
		toVerseCode: function() {
			if (this.bookID <= 0 || this.bookID > bible.Data.books.length) return "invalid";
			return 'v' + padLeft(this.bookID.toString(), 3, '0') + padLeft(this.chapter1.toString(), 3, '0') + padLeft(this.verse1.toString(), 3, '0');
		},
		prevChapter: function() {
			this.verse1 = 1;
			this.chapter2 = -1;
			this.verse2 = -1;
			if (this.chapter1 == 1 && this.bookID > 1) {
				this.bookID--;
				this.chapter1 = bible.Data.verses[this.bookID - 1].length;
			} else if ( this.chapter1 === 1 && this.bookID === 1 ) {
				return null;
			} else {
				this.chapter1--;
			}

			this.bookName = bible.getBook( this.bookID );
			return Object.assign( {}, this );
		},
		nextChapter: function() {
			this.verse1 = 1;
			this.chapter2 = -1;
			this.verse2 = -1;
			if (this.chapter1 < bible.Data.verses[this.bookID - 1].length) {
				this.chapter1++;
			} else if (this.bookID < bible.Data.books.length) {
				this.bookID++;
				this.chapter1 = 1;
			} else {
				return null;
			}

			this.bookName = bible.getBook( this.bookID );
			return Object.assign( {}, this );
		}
		,
		isFirstChapter: function() {
			return (this.bookID == 1 && this.chapter1 ==1); //  && this.verse1 == 1);
		},
		isLastChapter: function() {
			var v = bible.Data.verses[this.bookID-1];

			return (this.bookID	== bible.Data.books.length &&
				this.chapter1 == v.length);//  && 	this.verse1 == v[v.length-1]);
		},
		getBook: function() {
			return bible.Data.books[ this.bookID - 1 ][ 0 ];
		}
	}
};
bible.utility = {};
bible.getBookId = function( textReference ) {
	var input = textReference;
	var bookID = -1;
	// tear off book name
	for (var i = bible.Data.books.length - 1; i >= 0; i--) {
		for (var j = 0; j < bible.Data.books[i].length; j++) {
			var name = new String(bible.Data.books[i][j]).toLowerCase();
			var possibleMatch = input.substring(0, Math.floor(name.length, input.length)).toLowerCase();

			if (possibleMatch == name) {
				bookID = i + 1;
				input = input.substring(name.length);
				break;
			}

		}
		if (bookID > -1)
			break;
	}
	return bookID;
};
bible.getBook = function( bookId ) {
	return bible.Data.books[ bookId - 1][0];
};

bible.getTranslatedBookNameByLanguage = function( bookName, language ) {
	return bible.Data.bookNamesByLanguage[ language ][ bible.getBookId( bookName ) - 1 ];
};

bible.getTranslatedBookName = function( bookName, version ) {
	if ( ! bookName || ! version ) {
		return 'problemo';
	}
	var language = bible.Data.supportedVersions[ version ].language;
	return bible.getTranslatedBookNameByLanguage( bookName, language );
};

bible.isRtlVersion = function( version, book ) {
	var versionLanguage = bible.Data.supportedVersions[ version ].language;
	if ( bible.Data.rtlLanguages.indexOf( versionLanguage ) > -1 ) {
		return true;
	}

	if ( versionLanguage === 'original' && book && bible.Data.otBooks.indexOf( book ) > -1 ) {
		return true;
	}
};
