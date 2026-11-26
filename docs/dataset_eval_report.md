# VaultRAG 120-Pair Ragas Evaluation Report

> **Timestamp:** 2026-11-26 19:16:22 UTC
> **Scope:** 120 QA pairs across 20 documents (Single Tenant `vaultrag-eval-120`)
> **Generator:** `nvidia/nemotron-3.5-bolt-e4b` | **Reranker:** `nvidia/nemotron-3.5-rerank-8b` | **Judge:** `nvidia/nemotron-3.5-super-vl-120b-a12b`
> **Total NaN Judge Jobs:** `6` (strictly un-imputed)

## Summary Metrics

| Metric | Score | Valid / Total | NaNs |
| :--- | :--- | :--- | :--- |
| **faithfulness** | `0.7130` | 120 / 120 | 0 |
| **context_recall** | `0.5601` | 119 / 120 | 1 |
| **context_precision** | `0.5118` | 120 / 120 | 0 |
| **answer_correctness** | `0.6169` | 115 / 120 | 5 |
| **Negative Rejection Accuracy** | `70.0%` (28/40) | 40 / 40 | 0 |
| **Target Doc Hit Rate** | `95.0%` | 120 / 120 | 0 |
| **Retrieval Latency (p50 / p95)** | `6547.9 ms` / `13069.5 ms` | - | - |

## Per-Query Breakdown

| ID | Category | Doc | Hit | Faithfulness | Recall | Precision | Correctness | Neg-Reject | Query |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sp_001` | single_passage | 0 | Y | `1.00` | `1.00` | `1.00` | `0.57` | - | `What do keybullet kin drop?` |
| `sp_002` | single_passage | 0 | Y | `1.00` | `1.00` | `1.00` | `0.96` | - | `What kind of gun does the bandana bullet kin use?` |
| `sp_003` | single_passage | 1 | N | `0.00` | `0.00` | `0.00` | `0.04` | - | `What do the giants look like?` |
| `sp_004` | single_passage | 1 | Y | `1.00` | `1.00` | `0.75` | `0.77` | - | `What happens on day 2?` |
| `sp_005` | single_passage | 2 | Y | `1.00` | `1.00` | `1.00` | `0.87` | - | `What were the requirements for the project?` |
| `sp_006` | single_passage | 2 | Y | `1.00` | `1.00` | `0.83` | `0.67` | - | `What data did was used to test the prototype?` |
| `sp_007` | single_passage | 3 | Y | `1.00` | `1.00` | `1.00` | `NaN` | - | `How do the data storage options compare?` |
| `sp_008` | single_passage | 3 | Y | `1.00` | `1.00` | `1.00` | `0.99` | - | `When was UTF-8 support added for European languages?` |
| `sp_009` | single_passage | 4 | Y | `1.00` | `1.00` | `0.92` | `0.27` | - | `How do I make a button?` |
| `sp_010` | single_passage | 4 | Y | `1.00` | `1.00` | `1.00` | `0.33` | - | `When might I use caching?` |
| `sp_011` | single_passage | 5 | Y | `1.00` | `1.00` | `0.75` | `0.08` | - | `What are the key topics of this article?` |
| `sp_012` | single_passage | 5 | Y | `1.00` | `1.00` | `0.92` | `0.77` | - | `Do I have to do something all by myself to be acknowled...` |
| `sp_013` | single_passage | 6 | Y | `0.60` | `1.00` | `1.00` | `0.82` | - | `What kinds of models would need to be officially regist...` |
| `sp_014` | single_passage | 6 | Y | `1.00` | `1.00` | `0.50` | `0.61` | - | `What kinds of AI carry "systematic risks"?` |
| `sp_015` | single_passage | 7 | Y | `1.00` | `1.00` | `1.00` | `0.69` | - | `Which quest does the emperor give the player?` |
| `sp_016` | single_passage | 7 | Y | `1.00` | `1.00` | `1.00` | `0.99` | - | `Who ambushes the party at Wyrm's lookout?` |
| `sp_017` | single_passage | 8 | Y | `1.00` | `1.00` | `0.89` | `0.51` | - | `What did I drink at the pintxo bars?` |
| `sp_018` | single_passage | 8 | Y | `1.00` | `1.00` | `1.00` | `0.98` | - | `Which part of the trip did I like the most?` |
| `sp_019` | single_passage | 9 | Y | `1.00` | `1.00` | `1.00` | `NaN` | - | `What is the meaning behind the infrared scenes?` |
| `sp_020` | single_passage | 9 | Y | `1.00` | `1.00` | `1.00` | `0.66` | - | `How do the people who commit atrocious acts and those t...` |
| `sp_021` | single_passage | 10 | Y | `1.00` | `1.00` | `1.00` | `0.65` | - | `What is the policy on Tai Chi?` |
| `sp_022` | single_passage | 10 | Y | `1.00` | `1.00` | `1.00` | `0.99` | - | `What is the proposed change for the British museum` |
| `sp_023` | single_passage | 11 | Y | `1.00` | `1.00` | `0.75` | `0.75` | - | `How much faster is the Tesla A100 compared to the Tesla...` |
| `sp_024` | single_passage | 11 | Y | `1.00` | `1.00` | `1.00` | `0.97` | - | `For what work did I receive criticism for my reduction ...` |
| `sp_025` | single_passage | 12 | Y | `1.00` | `1.00` | `1.00` | `1.00` | - | `How does function exporting differ between Gleam and Py...` |
| `sp_026` | single_passage | 12 | Y | `1.00` | `1.00` | `1.00` | `0.58` | - | `What is the syntax for pipe` |
| `sp_027` | single_passage | 13 | Y | `1.00` | `1.00` | `1.00` | `0.50` | - | `Why are the top-right values in the raw attention weigh...` |
| `sp_028` | single_passage | 13 | Y | `1.00` | `1.00` | `0.50` | `0.63` | - | `How can I freeze a variable during training in MLX?` |
| `sp_029` | single_passage | 14 | Y | `1.00` | `1.00` | `1.00` | `0.47` | - | `How is the narrator related to Perry` |
| `sp_030` | single_passage | 14 | Y | `1.00` | `1.00` | `1.00` | `0.98` | - | `How long has the narrator been sober for?` |
| `sp_031` | single_passage | 15 | Y | `1.00` | `1.00` | `0.50` | `1.00` | - | `What is the name of the space station?` |
| `sp_032` | single_passage | 15 | Y | `1.00` | `1.00` | `1.00` | `0.39` | - | `What languages do the people of Pacifico del Rio speak?` |
| `sp_033` | single_passage | 16 | Y | `1.00` | `1.00` | `0.50` | `0.98` | - | `In which patch was pet adoption added?` |
| `sp_034` | single_passage | 16 | Y | `0.00` | `0.00` | `1.00` | `0.05` | - | `When did mushroom trees stop dropping wood?` |
| `sp_035` | single_passage | 17 | Y | `1.00` | `1.00` | `0.83` | `0.73` | - | `Where was Alan Wake 2 officially announced?` |
| `sp_036` | single_passage | 17 | Y | `1.00` | `1.00` | `0.83` | `0.99` | - | `When is this game set?` |
| `sp_037` | single_passage | 18 | Y | `1.00` | `1.00` | `0.83` | `0.98` | - | `Who wrote 'Divine Rivals'?` |
| `sp_038` | single_passage | 18 | Y | `1.00` | `1.00` | `1.00` | `0.87` | - | `Who was resurrected with a group of other murder victim...` |
| `sp_039` | single_passage | 19 | Y | `1.00` | `1.00` | `1.00` | `0.83` | - | `What categories does this paper split the RAG technique...` |
| `sp_040` | single_passage | 19 | Y | `1.00` | `1.00` | `1.00` | `0.69` | - | `In what way can including unrelated documents affect th...` |
| `mp_001` | multi_passage | 0 | Y | `0.50` | `1.00` | `0.95` | `0.97` | - | `Which enemy types wield an AK-47?` |
| `mp_002` | multi_passage | 0 | Y | `1.00` | `1.00` | `1.00` | `0.89` | - | `What makes jammed enemies different?` |
| `mp_003` | multi_passage | 1 | Y | `1.00` | `1.00` | `1.00` | `0.99` | - | `What enemies are encountered in the second encounter?` |
| `mp_004` | multi_passage | 1 | Y | `1.00` | `0.60` | `0.00` | `0.71` | - | `What monsters are encountered in this journey?` |
| `mp_005` | multi_passage | 2 | Y | `1.00` | `1.00` | `1.00` | `0.47` | - | `What framework was chosen to execute the RAG process an...` |
| `mp_006` | multi_passage | 2 | Y | `1.00` | `1.00` | `0.50` | `0.91` | - | `Which large language models and vector databases were s...` |
| `mp_007` | multi_passage | 3 | Y | `1.00` | `1.00` | `0.95` | `0.69` | - | `What kind of model is the bling-phi-3 model` |
| `mp_008` | multi_passage | 3 | Y | `0.60` | `0.00` | `0.00` | `NaN` | - | `In which versions were the SLIM models updated?` |
| `mp_009` | multi_passage | 4 | Y | `1.00` | `0.86` | `1.00` | `0.34` | - | `What are the ways of grouping UI elements together?` |
| `mp_010` | multi_passage | 4 | Y | `1.00` | `1.00` | `0.00` | `0.59` | - | `What are the parameters for the mo.ui.text function?` |
| `mp_011` | multi_passage | 5 | Y | `1.00` | `0.25` | `0.00` | `0.18` | - | `What are the given examples of common challenges?` |
| `mp_012` | multi_passage | 5 | Y | `1.00` | `1.00` | `0.58` | `0.78` | - | `What are the four steps to become more impact-focused?` |
| `mp_013` | multi_passage | 6 | Y | `0.96` | `1.00` | `0.83` | `NaN` | - | `What are the risk classifications for AI?` |
| `mp_014` | multi_passage | 6 | Y | `1.00` | `0.75` | `0.75` | `0.51` | - | `What are the rules for developing general purpose AI mo...` |
| `mp_015` | multi_passage | 7 | Y | `1.00` | `0.00` | `0.59` | `0.54` | - | `What are the emperor's aliases?` |
| `mp_016` | multi_passage | 7 | Y | `1.00` | `1.00` | `0.83` | `0.62` | - | `Who was Duke Stelmane?` |
| `mp_017` | multi_passage | 8 | Y | `0.50` | `0.50` | `0.50` | `0.43` | - | `Where was I offered desserts?` |
| `mp_018` | multi_passage | 8 | N | `0.00` | `0.00` | `0.00` | `0.12` | - | `What forms of exercise did we do?` |
| `mp_019` | multi_passage | 9 | Y | `1.00` | `1.00` | `1.00` | `0.88` | - | `Who is in the family that this film is about?` |
| `mp_020` | multi_passage | 9 | Y | `1.00` | `1.00` | `1.00` | `0.45` | - | `What items do Rudolf's family take from the Jews and wh...` |
| `mp_021` | multi_passage | 10 | Y | `1.00` | `1.00` | `1.00` | `0.27` | - | `What are the proposed changes that affect healthcare?` |
| `mp_022` | multi_passage | 10 | Y | `1.00` | `1.00` | `0.00` | `0.81` | - | `What versions of the Manicfesto are there?` |
| `mp_023` | multi_passage | 11 | Y | `1.00` | `0.20` | `0.00` | `0.56` | - | `Other than this blog post, what has the author written?` |
| `mp_024` | multi_passage | 11 | N | `0.80` | `0.00` | `0.00` | `0.07` | - | `In what contexts is BERT mentioned?` |
| `mp_025` | multi_passage | 12 | Y | `1.00` | `1.00` | `0.95` | `0.24` | - | `What data structures does Gleam natively support?` |
| `mp_026` | multi_passage | 12 | Y | `1.00` | `1.00` | `1.00` | `0.74` | - | `What things will cause a compilation error in Gleam?` |
| `mp_027` | multi_passage | 13 | Y | `1.00` | `1.00` | `1.00` | `0.70` | - | `Where is broadcasting used?` |
| `mp_028` | multi_passage | 13 | Y | `1.00` | `0.50` | `1.00` | `0.47` | - | `What is Karpathy known for?` |
| `mp_029` | multi_passage | 14 | Y | `1.00` | `0.50` | `0.58` | `0.15` | - | `What things did Jackie remember differently to what she...` |
| `mp_030` | multi_passage | 14 | Y | `0.92` | `0.75` | `0.58` | `0.34` | - | `What references to alcohol are there` |
| `mp_031` | multi_passage | 15 | Y | `1.00` | `1.00` | `0.92` | `0.60` | - | `Where does the Doctor say that he is a time lord?` |
| `mp_032` | multi_passage | 15 | Y | `1.00` | `0.00` | `0.81` | `0.57` | - | `Who are the characters in this script?` |
| `mp_033` | multi_passage | 16 | Y | `0.75` | `NaN` | `1.00` | `0.42` | - | `What can moss be used for?` |
| `mp_034` | multi_passage | 16 | Y | `0.50` | `1.00` | `0.33` | `0.97` | - | `What are all of the sources of battery packs that have ...` |
| `mp_035` | multi_passage | 17 | Y | `1.00` | `1.00` | `1.00` | `0.65` | - | `What things does Scratch do?` |
| `mp_036` | multi_passage | 17 | Y | `1.00` | `1.00` | `1.00` | `0.64` | - | `What is Alan tricked into believing by his wife?` |
| `mp_037` | multi_passage | 18 | Y | `0.93` | `1.00` | `0.70` | `NaN` | - | `Which books have dragons in them?` |
| `mp_038` | multi_passage | 18 | Y | `1.00` | `0.00` | `0.25` | `0.52` | - | `Which books contain multiple narratives?` |
| `mp_039` | multi_passage | 19 | Y | `1.00` | `0.75` | `0.50` | `0.36` | - | `What is the recommended way to index text for question-...` |
| `mp_040` | multi_passage | 19 | Y | `1.00` | `1.00` | `1.00` | `0.95` | - | `What are the advantages and disadvantages of the BM25 a...` |
| `na_001` | no_answer | 0 | Y | `0.00` | `0.00` | `0.00` | `1.00` | PASS | `How much health does the Mutant Bullet Kin have?` |
| `na_002` | no_answer | 0 | Y | `0.00` | `0.00` | `0.00` | `0.89` | PASS | `Where can bishops be found?` |
| `na_003` | no_answer | 1 | Y | `0.00` | `0.00` | `0.00` | `1.00` | PASS | `What happened on day 10?` |
| `na_004` | no_answer | 1 | Y | `0.92` | `0.00` | `0.00` | `0.05` | FAIL | `What did the goblins say?` |
| `na_005` | no_answer | 2 | N | `1.00` | `0.00` | `0.00` | `-0.00` | FAIL | `Why was the H100 GPU chosen for computation?` |
| `na_006` | no_answer | 2 | Y | `0.00` | `0.00` | `0.00` | `0.75` | PASS | `Which masked language model was chosen for the AI?` |
| `na_007` | no_answer | 3 | Y | `1.00` | `0.00` | `0.00` | `0.07` | FAIL | `When was GPT 4 made available` |
| `na_008` | no_answer | 3 | N | `0.00` | `0.00` | `0.00` | `1.00` | PASS | `What Tensorflow features are supported?` |
| `na_009` | no_answer | 4 | Y | `0.00` | `0.00` | `0.00` | `0.62` | PASS | `How can I create graphs?` |
| `na_010` | no_answer | 4 | Y | `0.00` | `0.00` | `0.00` | `0.75` | PASS | `What is the name of the Java version of marimo?` |
| `na_011` | no_answer | 5 | Y | `1.00` | `0.00` | `0.00` | `0.02` | FAIL | `What is step 5?` |
| `na_012` | no_answer | 5 | Y | `0.00` | `0.00` | `0.00` | `0.62` | PASS | `What is the advice for data scientists in finance compa...` |
| `na_013` | no_answer | 6 | Y | `0.00` | `0.00` | `0.00` | `1.00` | PASS | `What obligations are robots expected to follow?` |
| `na_014` | no_answer | 6 | Y | `0.00` | `0.00` | `0.00` | `1.00` | PASS | `How long are the minimum prison sentences for rule brea...` |
| `na_015` | no_answer | 7 | Y | `0.79` | `0.00` | `0.00` | `0.02` | FAIL | `What needs to be done to kiss the Emperor?` |
| `na_016` | no_answer | 7 | Y | `0.00` | `0.00` | `0.00` | `0.62` | PASS | `How many wings did Balduran have?` |
| `na_017` | no_answer | 8 | Y | `0.00` | `0.00` | `0.00` | `0.62` | PASS | `What is the author's favourite thing about Barcelona?` |
| `na_018` | no_answer | 8 | Y | `1.00` | `0.00` | `0.00` | `0.03` | FAIL | `Did the author prefer Madrid or San Sebastian?` |
| `na_019` | no_answer | 9 | Y | `0.00` | `0.00` | `0.00` | `0.75` | PASS | `Who plays the boy in striped pyjamas?` |
| `na_020` | no_answer | 9 | Y | `0.00` | `0.00` | `0.00` | `0.55` | PASS | `What relgion are the members of the Hoss family?` |
| `na_021` | no_answer | 10 | Y | `0.00` | `0.00` | `0.00` | `0.62` | PASS | `What is the policy on semi-skimmed milk?` |
| `na_022` | no_answer | 10 | Y | `1.00` | `0.00` | `0.00` | `0.11` | FAIL | `What kind of pumps will be given to people to solve inf...` |
| `na_023` | no_answer | 11 | Y | `0.00` | `0.00` | `0.00` | `1.00` | PASS | `Which TPU is recommended?` |
| `na_024` | no_answer | 11 | Y | `0.00` | `0.00` | `0.00` | `1.00` | PASS | `What is the rest temperature of the RTX 4090 GPU?` |
| `na_025` | no_answer | 12 | Y | `0.00` | `0.00` | `0.00` | `0.85` | PASS | `What does the ++ operator do in Gleam?` |
| `na_026` | no_answer | 12 | Y | `0.00` | `0.00` | `0.00` | `1.00` | PASS | `How do sets in Python compare to sets in Gleam?` |
| `na_027` | no_answer | 13 | Y | `0.00` | `0.00` | `0.00` | `0.75` | PASS | `How many parameters does the transformer model have?` |
| `na_028` | no_answer | 13 | Y | `1.00` | `0.00` | `0.00` | `0.09` | FAIL | `What is the advantage of transformers other other model...` |
| `na_029` | no_answer | 14 | Y | `0.00` | `0.00` | `0.00` | `1.00` | PASS | `What brand of bourbon did the narrator drink?` |
| `na_030` | no_answer | 14 | Y | `1.00` | `0.00` | `0.00` | `0.08` | FAIL | `Who is Perry and Jackie's sibling?` |
| `na_031` | no_answer | 15 | Y | `0.00` | `0.00` | `0.00` | `0.62` | PASS | `What colour is Nan-E?` |
| `na_032` | no_answer | 15 | Y | `0.97` | `0.00` | `0.00` | `0.05` | FAIL | `What does Robby, the baby, say to the Doctor?` |
| `na_033` | no_answer | 16 | Y | `0.00` | `0.00` | `0.00` | `0.62` | PASS | `In what version was the velociraptor introduced?` |
| `na_034` | no_answer | 16 | Y | `0.00` | `0.00` | `0.00` | `0.75` | PASS | `What was added in version 1.5.7?` |
| `na_035` | no_answer | 17 | Y | `1.00` | `0.00` | `0.00` | `0.04` | FAIL | `Why did Saga stab Scratch?` |
| `na_036` | no_answer | 17 | Y | `0.00` | `0.00` | `0.00` | `0.75` | PASS | `What caliber is the bullet of light?` |
| `na_037` | no_answer | 18 | Y | `0.00` | `0.00` | `0.00` | `1.00` | PASS | `In 'he who drowned the world', why did Gong Li sacrific...` |
| `na_038` | no_answer | 18 | Y | `0.00` | `0.00` | `0.00` | `0.62` | PASS | `Which book is the best?` |
| `na_039` | no_answer | 19 | Y | `0.00` | `0.00` | `0.00` | `0.85` | PASS | `Which paper by Hinton et. al. was used in this paper?` |
| `na_040` | no_answer | 19 | N | `0.83` | `0.00` | `0.00` | `0.03` | FAIL | `Why was hardware such a limiting factor in this researc...` |
