# 0001 — Single student identity via a link code

Students may both self-sign-up (email + password) and be Coordinator-provisioned (an access-code account). To avoid a single human ending up with two unrelated identities and split progress, a one-time **link code** merges the two into one identity — reusing the existing registration *claim code* pattern. Code-only students (no email) never need it.

## Considered options
- **Link the two accounts with a code (chosen).** One human, one progress history; the Coordinator dashboard sees everything.
- **Two separate accounts on purpose.** Simpler to build, but splits a student's practice/exam history and breaks the educator's view of their own students.
