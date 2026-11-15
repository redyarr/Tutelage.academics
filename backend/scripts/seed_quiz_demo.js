// ============================================================================
// SEED: placement quiz demo content (3 sections, 30 quiz questions, 2 reading passages)
// ============================================================================
// Grammar (reuses an existing "grammer"/"grammar" section), Writing, and Reading Comprehension
// with two passages on questions 1-4 and 5-8 (9-10 stay random). Adds only what is missing, so
// running it twice changes nothing. Questions are matched by text within their section.
// Usage: node scripts/seed_quiz_demo.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, User, QuizSection, QuizQuestion, QuizPassage } = require('../models');

// [level, text, [A, B, C, D], correct index]
const GRAMMAR = [
  ['A1', 'She ______ a teacher.', ['is', 'are', 'am', 'be'], 0],
  ['A1', 'I ______ coffee every morning.', ['drinks', 'drink', 'drinking', 'am drink'], 1],
  ['A1', 'There ______ two cats in the garden.', ['is', 'be', 'are', 'am'], 2],
  ['A2', 'We ______ to the cinema last night.', ['go', 'goes', 'went', 'gone'], 2],
  ['A2', 'He is ______ than his brother.', ['tall', 'taller', 'tallest', 'more tall'], 1],
  ['A2', 'Have you ever ______ to London?', ['be', 'was', 'been', 'being'], 2],
  ['A2', "I'm going ______ my grandmother this weekend.", ['visit', 'to visit', 'visiting', 'visited'], 1],
  ['B1', 'If it rains tomorrow, we ______ at home.', ['stay', 'will stay', 'would stay', 'stayed'], 1],
  ['B1', 'The letter ______ yesterday.', ['was sent', 'sent', 'is sending', 'has sent'], 0],
  ['B1', 'She asked me where I ______.', ['live', 'lived', 'am living', 'will live'], 1],
  ['B1', "I've lived here ______ 2015.", ['for', 'since', 'from', 'during'], 1],
  ['B1', "You ______ wear a seatbelt. It's the law.", ['must', 'might', 'could', 'would'], 0],
  ['B1', 'This is the book ______ I told you about.', ['who', 'whom', 'which', 'whose'], 2],
  ['B2', 'If I ______ about the traffic, I would have left earlier.', ['knew', 'had known', 'have known', 'would know'], 1],
  ['B2', 'By the time we arrived, the film ______.', ['already started', 'has already started', 'had already started', 'was already starting'], 2],
];

const WRITING = [
  ['A1', 'Which sentence is written correctly?', ['i live in erbil.', 'I live in Erbil.', 'I live in erbil.', 'i Live in Erbil.'], 1],
  ['A1', 'Choose the correct spelling.', ['freind', 'friend', 'frend', 'freend'], 1],
  ['A1', 'Choose the best word: I like tea ______ coffee.', ['and', 'but', 'because', 'so'], 0],
  ['A2', 'Choose the best linking word: It was raining, ______ we stayed inside.', ['but', 'so', 'because', 'although'], 1],
  ['A2', 'Which sentence has the correct punctuation?', ['Where do you live.', 'Where do you live?', 'where do you live?', 'Where, do you live?'], 1],
  ['A2', 'Put the words in order: always / she / early / gets up', ['She always gets up early.', 'She gets always up early.', 'Always she gets up early.', 'She gets up always early.'], 0],
  ['A2', 'How do you start an email to a friend called Sara?', ['Dear Sir or Madam,', 'Hi Sara,', 'To whom it may concern,', 'Yours sincerely,'], 1],
  ['B1', 'Choose the best linking word: ______ he was tired, he finished the report.', ['Because', 'Although', 'So', 'Unless'], 1],
  ['B1', 'Which is the best way to end a formal email?', ['See you!', 'Cheers,', 'Yours sincerely,', 'Love,'], 2],
  ['B1', 'Which sentence has the correct commas?', ['My brother who lives in Duhok is a doctor.', 'My brother, who lives in Duhok, is a doctor.', 'My brother, who lives in Duhok is a doctor.', 'My, brother who lives in Duhok, is a doctor.'], 1],
  ['B1', 'Which request is the most formal?', ['Can you send me the file?', 'Send me the file.', 'I would be grateful if you could send me the file.', 'File, please.'], 2],
  ['B2', 'Choose the best word: The plan is expensive. ______, it will save money in the long term.', ['Therefore', 'However', 'Moreover', 'As a result'], 1],
  ['B2', 'Choose the best topic sentence for a paragraph about the benefits of cycling to work.', ['I have a red bicycle.', 'Cycling to work improves both your health and your budget.', 'Some people drive to work.', 'Bicycles were invented in the 19th century.'], 1],
  ['B2', 'Choose the correct word: The new rules will ______ everyone in the company.', ['affect', 'effect', 'effort', 'afford'], 0],
];

const PASSAGES = [
  {
    title: 'A Day at the Market',
    startPosition: 1,
    endPosition: 4,
    text: `Every Saturday, Sara and her grandfather go to the old market in the centre of Erbil. They leave home at seven o'clock, before the streets get busy and before the sun gets too hot.

Her grandfather always buys the same things: fresh bread, a bag of tomatoes, and cheese from a small shop near the clock tower. The man who owns the cheese shop has known Sara's grandfather for forty years. They talk about the weather, football and the old days while Sara looks at the colourful spices.

This Saturday was different. When they arrived at the cheese shop, it was closed. A note on the door said: "Closed today. My daughter is getting married!" Sara's grandfather smiled and said, "We will buy cheese next week. Today, let's try something new."

They walked to a café that Sara had never visited. Her grandfather ordered two glasses of tea and a plate of kleicha, small sweet biscuits with dates inside. Sara decided that this was the best Saturday of the year.`,
    questions: [
      ['A2', 'Why do Sara and her grandfather leave home at seven o\'clock?', ['Because the market opens at seven.', 'To avoid the crowds and the heat.', 'Because Sara has school later.', 'To meet the cheese shop owner.'], 1],
      ['A2', 'How long has the cheese shop owner known Sara\'s grandfather?', ['Four years', 'Fourteen years', 'Forty years', 'Since last Saturday'], 2],
      ['A2', 'Why was the cheese shop closed?', ['The owner was ill.', 'It was a public holiday.', "The owner's daughter was getting married.", 'The shop had no cheese left.'], 2],
      ['A2', 'What did Sara and her grandfather do instead?', ['They went home early.', 'They went to a café and tried kleicha.', 'They bought cheese at another shop.', 'They waited outside the shop.'], 1],
    ],
  },
  {
    title: 'Working From Home',
    startPosition: 5,
    endPosition: 8,
    text: `Ten years ago, working from home was unusual. Most companies believed that employees needed to be in the office to work well, and managers wanted to see their teams at their desks. Then, almost overnight, millions of people had to set up offices in their kitchens and bedrooms.

At first, many workers enjoyed the change. They no longer spent hours in traffic, and they could organise their day around their families. Several studies found that people working from home were just as productive as before, and some were even more productive.

However, the picture is not entirely positive. Many remote workers say they feel lonely, and young employees in particular miss the chance to learn by watching more experienced colleagues. Others find it hard to stop working when the office is also their living room, so their working day slowly gets longer.

Today, a growing number of companies are choosing a hybrid model: staff spend two or three days in the office and work from home for the rest of the week. Supporters argue that this combines the best of both worlds, although critics point out that it only works if teams agree on which days everyone will be in the office.`,
    questions: [
      ['B1', 'According to the text, why did companies not like working from home in the past?', ['It was too expensive.', 'They believed people worked better in the office.', 'Employees did not want to do it.', 'The technology did not exist.'], 1],
      ['B1', 'What did several studies find?', ['Home workers were less productive.', 'Home workers were at least as productive as before.', 'Home workers spent more time in traffic.', 'Home workers earned more money.'], 1],
      ['B2', 'Why might young employees find remote work difficult?', ['They have smaller homes.', 'They cannot learn by watching experienced colleagues.', 'They prefer to work longer hours.', 'They do not like their managers.'], 1],
      ['B2', 'What do critics say about the hybrid model?', ['It is the best of both worlds.', 'It is too expensive for companies.', 'It only works if teams agree on their office days.', 'It makes people lonely.'], 2],
    ],
  },
];

// Short reading items for the numbers the passages leave free (9-10).
const READING_EXTRA = [
  ['A2', 'Read the sign: "Please keep your ticket. You will need it to leave the car park." What should you do?', ['Throw your ticket away.', 'Keep your ticket until you leave.', 'Show your ticket at the entrance.', 'Buy a new ticket to leave.'], 1],
  ['B1', 'Read: "The museum is open daily from 9:00 to 17:00, except Mondays." When can you NOT visit the museum?', ['Sunday at 10:00', 'Monday at 11:00', 'Friday at 16:00', 'Saturday at 9:30'], 1],
  ['B1', 'Read: "Applications must be received no later than 30 June." What does this mean?', ['You can apply after 30 June.', 'Your application must arrive by 30 June.', 'Applications open on 30 June.', 'You must apply in person on 30 June.'], 1],
  ['B2', 'Read: "Despite the heavy rain, the match went ahead as planned." What happened to the match?', ['It was cancelled.', 'It was moved to another day.', 'It took place as planned.', 'It stopped because of the rain.'], 2],
];

const SECTIONS = [
  { names: ['grammer', 'grammar'], name: 'Grammar', slug: 'grammar', displayOrder: 0, levelDistribution: { A1: 2, A2: 3, B1: 4, B2: 1 }, questions: GRAMMAR },
  { names: ['writing'], name: 'Writing', slug: 'writing', displayOrder: 1, levelDistribution: { A1: 2, A2: 3, B1: 3, B2: 2 }, questions: WRITING },
  { names: ['reading comprehension'], name: 'Reading Comprehension', slug: 'reading_comprehension', displayOrder: 2, levelDistribution: null, questions: READING_EXTRA, passages: PASSAGES },
];

const row = ([level, text, options, correctAnswer]) => ({
  level, text, optionA: options[0], optionB: options[1], optionC: options[2], optionD: options[3], correctAnswer,
});

async function seed() {
  const admin = await User.findOne({ where: { role: 'ADMIN' }, order: [['id', 'ASC']] });
  if (!admin) throw new Error('No ADMIN user to own the content');
  const createdBy = admin.id;
  const counts = { sections: 0, questions: 0, passages: 0 };

  await sequelize.transaction(async (transaction) => {
    const existing = await QuizSection.findAll({ transaction });
    for (const def of SECTIONS) {
      // An existing section keeps its name, order and split; only missing content is added.
      let section = existing.find((s) => def.names.includes(s.name.trim().toLowerCase()));
      if (!section) {
        section = await QuizSection.create({
          name: def.name, slug: def.slug, displayOrder: def.displayOrder, questionCount: 10,
          levelDistribution: def.levelDistribution, isActive: true, createdBy,
        }, { transaction });
        counts.sections++;
      }

      const have = new Set((await QuizQuestion.findAll({ where: { sectionId: section.id }, attributes: ['text'], transaction })).map((q) => q.text));
      for (const q of def.questions) {
        if (have.has(q[1])) continue;
        await QuizQuestion.create({ ...row(q), sectionId: section.id, displayOrder: 0, isActive: true, createdBy }, { transaction });
        counts.questions++;
      }

      for (const p of def.passages ?? []) {
        if (await QuizPassage.findOne({ where: { sectionId: section.id, title: p.title }, transaction })) continue;
        const passage = await QuizPassage.create({
          sectionId: section.id, title: p.title, text: p.text, startPosition: p.startPosition, endPosition: p.endPosition, isActive: true, createdBy,
        }, { transaction });
        counts.passages++;
        for (const [i, q] of p.questions.entries()) {
          await QuizQuestion.create({ ...row(q), sectionId: section.id, passageId: passage.id, displayOrder: i + 1, isActive: true, createdBy }, { transaction });
          counts.questions++;
        }
      }
    }
  });

  console.log(`✅ Added ${counts.sections} section(s), ${counts.passages} passage(s), ${counts.questions} question(s)`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
