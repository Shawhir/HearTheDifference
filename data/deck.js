/* Hear the Difference — deck data.
 *
 * Plain JSON wrapped in one assignment so the app loads with a <script> tag and
 * therefore works when index.html is opened straight off disk (file:// blocks
 * fetch() of a sibling .json). Edit by hand or with editor.html.
 */
window.HTD_DECK = {
  "version": 1,
  "title": "Hear the Difference",
  "subtitle": "h · th · i",
  "groups": [
    {
      "id": "h",
      "label": "Dropped H",
      "ipa": "/h/",
      "ipaNote": "",
      "title": "The dropped H",
      "blurb": "Whether the breath at the start is there at all.",
      "example": "heat · eat"
    },
    {
      "id": "th",
      "label": "Voiced TH",
      "ipa": "/ð/",
      "ipaNote": "vs /d/,/z/",
      "title": "The voiced TH",
      "blurb": "The soft buzz that becomes a hard d or z.",
      "example": "they · day"
    },
    {
      "id": "i",
      "label": "Long vs short i",
      "ipa": "/iː/",
      "ipaNote": "vs /ɪ/",
      "title": "Long vs short i",
      "blurb": "The tense ee against the lax, clipped ih.",
      "example": "sheep · ship"
    }
  ],
  "cards": [
    {
      "id": "h|air|hair>air",
      "group": "h",
      "options": [
        "air",
        "hair"
      ],
      "answer": "air",
      "audio": "audio/h/air.mp3"
    },
    {
      "id": "h|all|hall>hall",
      "group": "h",
      "options": [
        "all",
        "hall"
      ],
      "answer": "hall",
      "audio": "audio/h/hall.mp3"
    },
    {
      "id": "h|heat|eat>heat",
      "group": "h",
      "options": [
        "heat",
        "eat"
      ],
      "answer": "heat",
      "audio": "audio/h/heat.mp3"
    },
    {
      "id": "h|it|hit>hit",
      "group": "h",
      "options": [
        "it",
        "hit"
      ],
      "answer": "hit",
      "audio": "audio/h/hit.mp3"
    },
    {
      "id": "h|hall|all>all",
      "group": "h",
      "options": [
        "hall",
        "all"
      ],
      "answer": "all",
      "audio": "audio/h/hall.mp3"
    },
    {
      "id": "h|ill|hill>hill",
      "group": "h",
      "options": [
        "ill",
        "hill"
      ],
      "answer": "hill",
      "audio": "audio/h/hill.mp3"
    },
    {
      "id": "h|art|heart>heart",
      "group": "h",
      "options": [
        "art",
        "heart"
      ],
      "answer": "heart",
      "audio": "audio/h/heart.mp3"
    },
    {
      "id": "h|old|hold>hold",
      "group": "h",
      "options": [
        "old",
        "hold"
      ],
      "answer": "hold",
      "audio": "audio/h/hold.mp3"
    },
    {
      "id": "h|ate|hate>hate",
      "group": "h",
      "options": [
        "ate",
        "hate"
      ],
      "answer": "hate",
      "audio": "audio/h/hate.mp3"
    },
    {
      "id": "h|hill|ill>hill",
      "group": "h",
      "options": [
        "hill",
        "ill"
      ],
      "answer": "hill",
      "audio": "audio/h/hill.mp3"
    },
    {
      "id": "h|heart|art>heart",
      "group": "h",
      "options": [
        "heart",
        "art"
      ],
      "answer": "heart",
      "audio": "audio/h/heart.mp3"
    },
    {
      "id": "h|hold|old>hold",
      "group": "h",
      "options": [
        "hold",
        "old"
      ],
      "answer": "hold",
      "audio": "audio/h/hold.mp3"
    },
    {
      "id": "h|hate|ate>hate",
      "group": "h",
      "options": [
        "hate",
        "ate"
      ],
      "answer": "hate",
      "audio": "audio/h/hate.mp3"
    },
    {
      "id": "h|I'd|hide>hide",
      "group": "h",
      "options": [
        "I'd",
        "hide"
      ],
      "answer": "hide",
      "audio": "audio/h/hide.mp3"
    },
    {
      "id": "h|hide|I'd>hide",
      "group": "h",
      "options": [
        "hide",
        "I'd"
      ],
      "answer": "hide",
      "audio": "audio/h/hide.mp3"
    },
    {
      "id": "h|I hate lunch at noon|I ate lunch at noon>I hate lunch at noon",
      "group": "h",
      "options": [
        "I hate lunch at noon",
        "I ate lunch at noon"
      ],
      "answer": "I hate lunch at noon",
      "audio": "audio/h/i-hate-lunch-at-noon.mp3"
    },
    {
      "id": "h|I hate lunch at noon|I ate lunch at noon>I ate lunch at noon",
      "group": "h",
      "options": [
        "I hate lunch at noon",
        "I ate lunch at noon"
      ],
      "answer": "I ate lunch at noon",
      "audio": "audio/h/i-ate-lunch-at-noon.mp3"
    },
    {
      "id": "h|I ate the cookies|I hate the cookies>I hate the cookies",
      "group": "h",
      "options": [
        "I ate the cookies",
        "I hate the cookies"
      ],
      "answer": "I hate the cookies",
      "audio": "audio/h/i-hate-the-cookies.mp3"
    },
    {
      "id": "h|I ate the cookies|I hate the cookies>I ate the cookies",
      "group": "h",
      "options": [
        "I ate the cookies",
        "I hate the cookies"
      ],
      "answer": "I ate the cookies",
      "audio": null
    },
    {
      "id": "h|Her hair smells good|Her air smells good>Her air smells good",
      "group": "h",
      "options": [
        "Her hair smells good",
        "Her air smells good"
      ],
      "answer": "Her air smells good",
      "audio": "audio/h/her-air-smells-good.mp3"
    },
    {
      "id": "h|Her hair smells good|Her air smells good>Her hair smells good",
      "group": "h",
      "options": [
        "Her hair smells good",
        "Her air smells good"
      ],
      "answer": "Her hair smells good",
      "audio": null
    },
    {
      "id": "h|I can hit perfectly|I can it perfectly>I can hit perfectly",
      "group": "h",
      "options": [
        "I can hit perfectly",
        "I can it perfectly"
      ],
      "answer": "I can hit perfectly",
      "audio": null
    },
    {
      "id": "h|I can hit perfectly|I can it perfectly>I can it perfectly",
      "group": "h",
      "options": [
        "I can hit perfectly",
        "I can it perfectly"
      ],
      "answer": "I can it perfectly",
      "audio": null
    },
    {
      "id": "h|The Hill child needs help|The ill child needs help>The Hill child needs help",
      "group": "h",
      "options": [
        "The Hill child needs help",
        "The ill child needs help"
      ],
      "answer": "The Hill child needs help",
      "audio": null
    },
    {
      "id": "h|The Hill child needs help|The ill child needs help>The ill child needs help",
      "group": "h",
      "options": [
        "The Hill child needs help",
        "The ill child needs help"
      ],
      "answer": "The ill child needs help",
      "audio": "audio/h/the-ill-child-needs-help.mp3"
    },
    {
      "id": "h|I study heart at schools|I study art at school>I study art at school",
      "group": "h",
      "options": [
        "I study heart at schools",
        "I study art at school"
      ],
      "answer": "I study art at school",
      "audio": null
    },
    {
      "id": "h|I study heart at schools|I study art at school>I study heart at schools",
      "group": "h",
      "options": [
        "I study heart at schools",
        "I study art at school"
      ],
      "answer": "I study heart at schools",
      "audio": "audio/h/i-study-heart-at-schools.mp3"
    },
    {
      "id": "h|I'd better go now|Hyde better go now>Hyde better go now",
      "group": "h",
      "options": [
        "I'd better go now",
        "Hyde better go now"
      ],
      "answer": "Hyde better go now",
      "audio": "audio/h/hyde-better-go-now.mp3"
    },
    {
      "id": "h|I'd better go now|Hyde better go now>I'd better go now",
      "group": "h",
      "options": [
        "I'd better go now",
        "Hyde better go now"
      ],
      "answer": "I'd better go now",
      "audio": "audio/h/i-d-better-go-now.mp3"
    },
    {
      "id": "th|father|fazer>father",
      "group": "th",
      "options": [
        "father",
        "fazer"
      ],
      "answer": "father",
      "audio": "audio/th/father.mp3"
    },
    {
      "id": "th|brother|broder>brother",
      "group": "th",
      "options": [
        "brother",
        "broder"
      ],
      "answer": "brother",
      "audio": "audio/th/brother.mp3"
    },
    {
      "id": "th|this|dis>this",
      "group": "th",
      "options": [
        "this",
        "dis"
      ],
      "answer": "this",
      "audio": "audio/th/this.mp3"
    },
    {
      "id": "th|then|den>then",
      "group": "th",
      "options": [
        "then",
        "den"
      ],
      "answer": "then",
      "audio": "audio/th/then.mp3"
    },
    {
      "id": "th|there|dare>there",
      "group": "th",
      "options": [
        "there",
        "dare"
      ],
      "answer": "there",
      "audio": "audio/th/there.mp3"
    },
    {
      "id": "th|they|day>they",
      "group": "th",
      "options": [
        "they",
        "day"
      ],
      "answer": "they",
      "audio": "audio/th/they.mp3"
    },
    {
      "id": "th|though|dough>though",
      "group": "th",
      "options": [
        "though",
        "dough"
      ],
      "answer": "though",
      "audio": "audio/th/though.mp3"
    },
    {
      "id": "th|these|z’s>these",
      "group": "th",
      "options": [
        "these",
        "z’s"
      ],
      "answer": "these",
      "audio": "audio/th/these.mp3"
    },
    {
      "id": "th|their|zair>their",
      "group": "th",
      "options": [
        "their",
        "zair"
      ],
      "answer": "their",
      "audio": "audio/th/their.mp3"
    },
    {
      "id": "th|them|zem>them",
      "group": "th",
      "options": [
        "them",
        "zem"
      ],
      "answer": "them",
      "audio": "audio/th/them.mp3"
    },
    {
      "id": "th|fazer|father>fazer",
      "group": "th",
      "options": [
        "fazer",
        "father"
      ],
      "answer": "fazer",
      "audio": "audio/th/fazer.mp3"
    },
    {
      "id": "th|broder|brother>broder",
      "group": "th",
      "options": [
        "broder",
        "brother"
      ],
      "answer": "broder",
      "audio": "audio/th/broder.mp3"
    },
    {
      "id": "th|dis|this>dis",
      "group": "th",
      "options": [
        "dis",
        "this"
      ],
      "answer": "dis",
      "audio": "audio/th/dis.mp3"
    },
    {
      "id": "th|den|then>den",
      "group": "th",
      "options": [
        "den",
        "then"
      ],
      "answer": "den",
      "audio": "audio/th/den.mp3"
    },
    {
      "id": "th|dare|there>dare",
      "group": "th",
      "options": [
        "dare",
        "there"
      ],
      "answer": "dare",
      "audio": "audio/th/dare.mp3"
    },
    {
      "id": "th|day|they>day",
      "group": "th",
      "options": [
        "day",
        "they"
      ],
      "answer": "day",
      "audio": "audio/th/day.mp3"
    },
    {
      "id": "th|dough|though>dough",
      "group": "th",
      "options": [
        "dough",
        "though"
      ],
      "answer": "dough",
      "audio": "audio/th/dough.mp3"
    },
    {
      "id": "th|z’s|these>z’s",
      "group": "th",
      "options": [
        "z’s",
        "these"
      ],
      "answer": "z’s",
      "audio": "audio/th/zs.mp3"
    },
    {
      "id": "th|zair|their>zair",
      "group": "th",
      "options": [
        "zair",
        "their"
      ],
      "answer": "zair",
      "audio": "audio/th/zair.mp3"
    },
    {
      "id": "th|zem|them>zem",
      "group": "th",
      "options": [
        "zem",
        "them"
      ],
      "answer": "zem",
      "audio": "audio/th/zem.mp3"
    },
    {
      "id": "th|Dis is my book.|This is my book.>This is my book.",
      "group": "th",
      "options": [
        "Dis is my book.",
        "This is my book."
      ],
      "answer": "This is my book.",
      "audio": "audio/th/this-is-my-book.mp3"
    },
    {
      "id": "th|We saw dem.|We saw them.>We saw them.",
      "group": "th",
      "options": [
        "We saw dem.",
        "We saw them."
      ],
      "answer": "We saw them.",
      "audio": "audio/th/we-saw-them.mp3"
    },
    {
      "id": "th|I met dare teacher.|I met their teacher.>I met their teacher.",
      "group": "th",
      "options": [
        "I met dare teacher.",
        "I met their teacher."
      ],
      "answer": "I met their teacher.",
      "audio": "audio/th/i-met-their-teacher.mp3"
    },
    {
      "id": "th|Day will help us.|They will help us.>They will help us.",
      "group": "th",
      "options": [
        "Day will help us.",
        "They will help us."
      ],
      "answer": "They will help us.",
      "audio": "audio/th/they-will-help-us.mp3"
    },
    {
      "id": "th|Dough it rained, we walked.|Though it rained, we walked.>Though it rained, we walked.",
      "group": "th",
      "options": [
        "Dough it rained, we walked.",
        "Though it rained, we walked."
      ],
      "answer": "Though it rained, we walked.",
      "audio": null
    },
    {
      "id": "th|Zese apples are good.|These apples are good.>These apples are good.",
      "group": "th",
      "options": [
        "Zese apples are good.",
        "These apples are good."
      ],
      "answer": "These apples are good.",
      "audio": "audio/th/these-apples-are-good.mp3"
    },
    {
      "id": "th|I know zair parents.|I know their parents.>I know their parents.",
      "group": "th",
      "options": [
        "I know zair parents.",
        "I know their parents."
      ],
      "answer": "I know their parents.",
      "audio": "audio/th/i-met-their-teacher.mp3"
    },
    {
      "id": "th|Dis is my book.|This is my book.>Dis is my book.",
      "group": "th",
      "options": [
        "Dis is my book.",
        "This is my book."
      ],
      "answer": "Dis is my book.",
      "audio": null
    },
    {
      "id": "th|We saw dem.|We saw them.>We saw dem.",
      "group": "th",
      "options": [
        "We saw dem.",
        "We saw them."
      ],
      "answer": "We saw dem.",
      "audio": "audio/th/we-saw-dem.mp3"
    },
    {
      "id": "th|I met dare teacher.|I met their teacher.>I met dare teacher.",
      "group": "th",
      "options": [
        "I met dare teacher.",
        "I met their teacher."
      ],
      "answer": "I met dare teacher.",
      "audio": "audio/th/i-met-dare-teacher.mp3"
    },
    {
      "id": "th|Dough it rained, we walked.|Though it rained, we walked.>Dough it rained, we walked.",
      "group": "th",
      "options": [
        "Dough it rained, we walked.",
        "Though it rained, we walked."
      ],
      "answer": "Dough it rained, we walked.",
      "audio": null
    },
    {
      "id": "th|Zese apples are good.|These apples are good.>Zese apples are good.",
      "group": "th",
      "options": [
        "Zese apples are good.",
        "These apples are good."
      ],
      "answer": "Zese apples are good.",
      "audio": "audio/th/zese-apples-are-good.mp3"
    },
    {
      "id": "th|I know zair parents.|I know their parents.>I know zair parents.",
      "group": "th",
      "options": [
        "I know zair parents.",
        "I know their parents."
      ],
      "answer": "I know zair parents.",
      "audio": "audio/th/i-know-zair-parents.mp3"
    },
    {
      "id": "i|ship|sheep>ship",
      "group": "i",
      "options": [
        "ship",
        "sheep"
      ],
      "answer": "ship",
      "audio": "audio/i/ship.mp3"
    },
    {
      "id": "i|pit|peat>pit",
      "group": "i",
      "options": [
        "pit",
        "peat"
      ],
      "answer": "pit",
      "audio": "audio/i/pit.mp3"
    },
    {
      "id": "i|sit|seat>sit",
      "group": "i",
      "options": [
        "sit",
        "seat"
      ],
      "answer": "sit",
      "audio": "audio/i/sit.mp3"
    },
    {
      "id": "i|bit|beat>bit",
      "group": "i",
      "options": [
        "bit",
        "beat"
      ],
      "answer": "bit",
      "audio": "audio/i/bit.mp3"
    },
    {
      "id": "h|hit|heat>hit",
      "group": "h",
      "options": [
        "hit",
        "heat"
      ],
      "answer": "hit",
      "audio": "audio/h/hit.mp3"
    },
    {
      "id": "i|live|leave>live",
      "group": "i",
      "options": [
        "live",
        "leave"
      ],
      "answer": "live",
      "audio": "audio/i/live.mp3"
    },
    {
      "id": "i|slip|sleep>slip",
      "group": "i",
      "options": [
        "slip",
        "sleep"
      ],
      "answer": "slip",
      "audio": "audio/i/slip.mp3"
    },
    {
      "id": "i|fill|feel>fill",
      "group": "i",
      "options": [
        "fill",
        "feel"
      ],
      "answer": "fill",
      "audio": "audio/i/fill.mp3"
    },
    {
      "id": "i|ship|sheep>sheep",
      "group": "i",
      "options": [
        "ship",
        "sheep"
      ],
      "answer": "sheep",
      "audio": "audio/i/sheep.mp3"
    },
    {
      "id": "i|pit|peat>peat",
      "group": "i",
      "options": [
        "pit",
        "peat"
      ],
      "answer": "peat",
      "audio": "audio/i/peat.mp3"
    },
    {
      "id": "i|sit|seat>seat",
      "group": "i",
      "options": [
        "sit",
        "seat"
      ],
      "answer": "seat",
      "audio": "audio/i/seat.mp3"
    },
    {
      "id": "i|bit|beat>beat",
      "group": "i",
      "options": [
        "bit",
        "beat"
      ],
      "answer": "beat",
      "audio": "audio/i/beat.mp3"
    },
    {
      "id": "h|hit|heat>heat",
      "group": "h",
      "options": [
        "hit",
        "heat"
      ],
      "answer": "heat",
      "audio": "audio/h/heat.mp3"
    },
    {
      "id": "i|live|leave>leave",
      "group": "i",
      "options": [
        "live",
        "leave"
      ],
      "answer": "leave",
      "audio": "audio/i/leave.mp3"
    },
    {
      "id": "i|slip|sleep>sleep",
      "group": "i",
      "options": [
        "slip",
        "sleep"
      ],
      "answer": "sleep",
      "audio": "audio/i/sleep.mp3"
    },
    {
      "id": "i|fill|feel>feel",
      "group": "i",
      "options": [
        "fill",
        "feel"
      ],
      "answer": "feel",
      "audio": "audio/i/feel.mp3"
    },
    {
      "id": "i|The ship is small.|The sheep is small.>The sheep is small.",
      "group": "i",
      "options": [
        "The ship is small.",
        "The sheep is small."
      ],
      "answer": "The sheep is small.",
      "audio": "audio/i/the-sheep-is-small.mp3"
    },
    {
      "id": "i|The pit is deep.|The peat is deep.>The peat is deep.",
      "group": "i",
      "options": [
        "The pit is deep.",
        "The peat is deep."
      ],
      "answer": "The peat is deep.",
      "audio": "audio/i/the-peat-is-deep.mp3"
    },
    {
      "id": "i|The bit is hard.|The beat is hard.>The beat is hard.",
      "group": "i",
      "options": [
        "The bit is hard.",
        "The beat is hard."
      ],
      "answer": "The beat is hard.",
      "audio": null
    },
    {
      "id": "h|I hit the pizza|I heat the pizza.>I heat the pizza.",
      "group": "h",
      "options": [
        "I hit the pizza",
        "I heat the pizza."
      ],
      "answer": "I heat the pizza.",
      "audio": "audio/h/i-heat-the-pizza.mp3"
    },
    {
      "id": "th|She lives there|She leaves there>She lives there",
      "group": "th",
      "options": [
        "She lives there",
        "She leaves there"
      ],
      "answer": "She lives there",
      "audio": "audio/th/she-lives-there.mp3"
    },
    {
      "id": "i|The slip is dirty.|The sleep is long.>The sleep is long.",
      "group": "i",
      "options": [
        "The slip is dirty.",
        "The sleep is long."
      ],
      "answer": "The sleep is long.",
      "audio": "audio/i/the-sleep-is-long.mp3"
    },
    {
      "id": "i|Please fill the cup.|Please feel the cup.>Please feel the cup.",
      "group": "i",
      "options": [
        "Please fill the cup.",
        "Please feel the cup."
      ],
      "answer": "Please feel the cup.",
      "audio": "audio/i/please-feel-the-cup.mp3"
    },
    {
      "id": "i|The ship is small.|The sheep is small.>The ship is small.",
      "group": "i",
      "options": [
        "The ship is small.",
        "The sheep is small."
      ],
      "answer": "The ship is small.",
      "audio": "audio/i/the-ship-is-small.mp3"
    },
    {
      "id": "i|The pit is deep.|The peat is deep.>The pit is deep.",
      "group": "i",
      "options": [
        "The pit is deep.",
        "The peat is deep."
      ],
      "answer": "The pit is deep.",
      "audio": "audio/i/the-pit-is-deep.mp3"
    },
    {
      "id": "i|The bit is hard.|The beat is hard.>The bit is hard.",
      "group": "i",
      "options": [
        "The bit is hard.",
        "The beat is hard."
      ],
      "answer": "The bit is hard.",
      "audio": "audio/i/the-bit-is-hard.mp3"
    },
    {
      "id": "h|I hit the pizza|I heat the pizza.>I hit the pizza",
      "group": "h",
      "options": [
        "I hit the pizza",
        "I heat the pizza."
      ],
      "answer": "I hit the pizza",
      "audio": "audio/h/i-hit-the-pizza.mp3"
    },
    {
      "id": "th|She lives there|She leaves there>She leaves there",
      "group": "th",
      "options": [
        "She lives there",
        "She leaves there"
      ],
      "answer": "She leaves there",
      "audio": "audio/th/she-leaves-there.mp3"
    },
    {
      "id": "i|The slip is dirty.|The sleep is long.>The slip is dirty.",
      "group": "i",
      "options": [
        "The slip is dirty.",
        "The sleep is long."
      ],
      "answer": "The slip is dirty.",
      "audio": "audio/i/the-slip-is-dirty.mp3"
    },
    {
      "id": "i|Please fill the cup.|Please feel the cup.>Please fill the cup.",
      "group": "i",
      "options": [
        "Please fill the cup.",
        "Please feel the cup."
      ],
      "answer": "Please fill the cup.",
      "audio": "audio/i/please-fill-the-cup.mp3"
    }
  ]
};
