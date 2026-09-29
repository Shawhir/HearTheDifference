/* Study section — decks and grammar sheets.
 *
 * Plain JSON wrapped in one assignment so the pages load it with a <script>
 * tag and still work opened straight off disk. Edit by hand or with
 * study/editor.html. Paths are relative to the study/ folder.
 */
window.STUDY_DATA = {
  "version": 1,
  "decks": [
    {
      "id": "everyday-words",
      "kind": "picture",
      "title": "Everyday words",
      "blurb": "See the picture, say the word, then check.",
      "cards": [
        { "id": "w-apple", "word": "apple", "hint": "une pomme", "image": "images/everyday-words/apple.svg", "audio": null },
        { "id": "w-house", "word": "house", "hint": "une maison", "image": "images/everyday-words/house.svg", "audio": null },
        { "id": "w-sun", "word": "sun", "hint": "le soleil", "image": "images/everyday-words/sun.svg", "audio": null },
        { "id": "w-tree", "word": "tree", "hint": "un arbre", "image": "images/everyday-words/tree.svg", "audio": null },
        { "id": "w-car", "word": "car", "hint": "une voiture", "image": "images/everyday-words/car.svg", "audio": null },
        { "id": "w-book", "word": "book", "hint": "un livre", "image": "images/everyday-words/book.svg", "audio": null },
        { "id": "w-cup", "word": "cup", "hint": "une tasse", "image": "images/everyday-words/cup.svg", "audio": null },
        { "id": "w-clock", "word": "clock", "hint": "une horloge", "image": "images/everyday-words/clock.svg", "audio": null },
        { "id": "w-fish", "word": "fish", "hint": "un poisson", "image": "images/everyday-words/fish.svg", "audio": null },
        { "id": "w-because", "word": "because", "hint": "I stayed at home ___ it was raining.", "image": null, "audio": null },
        { "id": "w-often", "word": "often", "hint": "I ___ go to the cinema — about once a week.", "image": null, "audio": null }
      ]
    },
    {
      "id": "irregular-verbs",
      "kind": "verb",
      "title": "Irregular verbs",
      "blurb": "The base form, then its past simple and past participle.",
      "participle": true,
      "cards": [
        { "id": "v-go", "base": "go", "past": "went", "participle": "gone", "meaning": "aller" },
        { "id": "v-see", "base": "see", "past": "saw", "participle": "seen", "meaning": "voir" },
        { "id": "v-eat", "base": "eat", "past": "ate", "participle": "eaten", "meaning": "manger" },
        { "id": "v-take", "base": "take", "past": "took", "participle": "taken", "meaning": "prendre" },
        { "id": "v-have", "base": "have", "past": "had", "participle": "had", "meaning": "avoir" },
        { "id": "v-make", "base": "make", "past": "made", "participle": "made", "meaning": "faire, fabriquer" },
        { "id": "v-buy", "base": "buy", "past": "bought", "participle": "bought", "meaning": "acheter" },
        { "id": "v-write", "base": "write", "past": "wrote", "participle": "written", "meaning": "écrire" },
        { "id": "v-learn", "base": "learn", "past": "learned / learnt", "participle": "learned / learnt", "meaning": "apprendre" }
      ]
    }
  ],
  "grammar": [
    {
      "id": "g-past-simple",
      "title": "The past simple",
      "blurb": "Regular -ed endings, the three ways to say them, and questions with did.",
      "file": "grammar/past-simple.pdf"
    }
  ]
};
