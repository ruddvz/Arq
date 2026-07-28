# Editorial quality audit

## Scope

The supplied reference describes patterns often associated with AI-generated
writing. Those patterns are not reliable evidence of authorship. In Arq, they
are used only as prompts to examine specificity, evidence, tone and reader
utility.

## Required changes from 3.0

| Area              | 3.0 position                          | 4.0 change                                                                            |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| Authorship        | No explicit policy                    | Do not infer authorship or optimise for detector scores.                              |
| Public pages      | Bind selected claims                  | Inventory every public content file and require explicit classification.              |
| Generic rhetoric  | Hype rule only                        | Add review signals for inflated significance, vague attribution and canned assurance. |
| Review exceptions | Reason and expiry                     | Add evidence path, reviewer role and thirty-day maximum lifetime.                     |
| Installation      | Package map validates package sources | Verify the installed checkout against a separate integration contract.                |

## Human review rubric

Score each changed public page as pass or needs revision:

- Every present-tense product fact has a current evidence path.
- Every non-current fact carries the correct state language.
- Headings and cards are truthful when read alone.
- Every sentence supplies a fact, consequence, condition or action.
- No vague group is presented as authority.
- No qualification is hidden behind interaction or visual treatment.
- The final copy is readable by keyboard and assistive-technology users.

The rubric deliberately does not include a detector score or a prediction about
who wrote the copy.
