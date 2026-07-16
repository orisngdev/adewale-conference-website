# Adewale Students Conference — Resource Portal

The learning portal for the Adewale STEM programme: students practise for the STEM Contest and study offline, coordinators guide their school's team, and admins curate the content. This glossary is the shared language for the portal domain; keep it authoritative and implementation-free.

## Language

### People & identity

**Student**:
A secondary-school user who studies and practises in the portal (`profiles.role='student'`). One human = one identity. Arrives by self-signup (email + password; no SMS) or by Coordinator provisioning (an access code, for the no-email majority).
_Avoid_: learner (reserve for a DiPER LIN), pupil.

**Coordinator**:
A teacher who manages a school's team and guides its students (`profiles.role='coordinator'`, an approved `school_members` row). Curates Learning Plans and attaches their own links/notes, but does not author questions.
_Avoid in code_: Educator, Teacher, Mentor (UI may show "Educator").

**Rep** (Team Representative):
A Student who is a member of a school's registered contest team (a `students` row), provisioned by a Coordinator, able to log in by access code.
_Avoid_: Contestant, participant.

**Link code**:
A one-time code that merges a self-signed-up Student identity with a Coordinator-provisioned Rep account so one human keeps a single progress history. Mirrors the registration claim code.

### Assessments

**Assessment**:
A runnable test — either a Practice Drill or an Exam.
_Avoid_: quiz.

**Practice Drill**:
A faithful rehearsal of the Exam experience (same navigator, single full-duration timer, no-tab-switch discipline) that is marked and recorded (visible to the Student and their Coordinator) but never high-stakes, and runs offline. Its proctoring is training, not security, so correct answers may reach the device.
_Avoid_: quiz, speed drill.

**Exam**:
A high-stakes, online, server-graded Assessment. Correct answers never leave the server; attempts are limited and proctored. Only Exams decide selection or qualifying.

**Question Bank**:
The admin-only pool of questions. Every question belongs to exactly one pool — *practice* (answers may be revealed to devices) or *exam* (answers stay server-side).
_Avoid_: question set.

**Promotion**:
The one-way act of copying a retired Exam question into the practice pool so a later cohort can drill on real past material.

### Learning plans

**Learning Plan**:
A Coordinator-authored (or admin-template) ordered checklist of study for a group of Students — an ordered set of Modules, each an ordered set of Items. Order is a recommendation, not a gate.
_Avoid_: course, curriculum (implies enforced sequencing).

**Module**:
An ordered section of a Learning Plan, optionally with a due date.

**Item**:
One step in a Module — an Assessment, a study pack, an external link, or a note. `required` Items count toward the plan's progress %.

**Progress**:
A Student's completion state across a Plan's required Items (a %). Assessment Items complete by recording a real attempt; study packs by opening; links/notes by "Mark done".

### Programme

**Edition**:
One yearly run of the programme (e.g. 2026), with its own roster, stages, and registration window (`editions` table). Rosters, assignments, and progress are always scoped to an Edition; a Coordinator only ever sees or assigns the current Edition's Students.
_Avoid_: cohort, season, year (as a bare noun).

**Resource**:
A library item admins publish in the portal for Students and Coordinators to open or download — a Study Pack, the competition guidelines, a syllabus, a video, or an external link. Every Resource carries an **Access tier** and an **Audience**. Managed entirely in the portal (admins upload, tier, publish, delete).
_Avoid_: asset, material, file (for the umbrella noun).

**Access tier**:
How far a school must have progressed for its people to open a Resource's file — **Public**, **Accepted**, **Qualified**, or **Finalist** — mirroring the Registration status ladder. A locked Resource is still *listed* (as motivation), but its file is withheld until the school reaches the tier.

**Audience**:
Who a Resource is shown to — **Students**, **Coordinators**, or **both**. A Student sees only Student-facing Resources in their portal; a Coordinator (and an admin) sees every Resource, so they can attach any of them to a Learning Plan.

**Study Pack**:
A free, Public-tier Resource of study material (past questions, study guide, syllabus). The portal logs who opens/downloads each one, which feeds a Student's Progress.
_Avoid_: study resource (use Resource for the umbrella).
