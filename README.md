# Personal Finance Telegram Bot

**A multilingual application for recording income and expenses and reviewing financial activity through Telegram.**

**Author:** Elbaraa Saber  
**Project area:** Software Engineering · Backend Development · Database Design

## Project Overview

This project brings everyday financial record keeping into a messaging interface. Users can record income and expenses, review transaction history, and generate financial summaries without maintaining a separate spreadsheet. The application connects Telegram interactions to persistent database storage and presents its interface in Arabic, Russian, or English.

The project demonstrates a connected software workflow: interpreting user input, validating transaction details, associating records with the correct user, storing data, aggregating results, and presenting a readable response. Its engineering focus is on separating interaction logic, application services, and database operations so that the system can be extended and evaluated systematically.

This README provides an academic portfolio overview for reviewers, including those assessing an application for master's study in software engineering. It describes implemented functionality and distinguishes it from proposed improvements.

## Problem and Motivation

Small, frequent expenses are easy to forget when recording is postponed. A separate budgeting tool or spreadsheet also introduces an additional step into the user's routine. The project addresses this practical problem by making transaction entry available within Telegram and offering both guided input and short text commands.

The intended users include students and individuals who need a straightforward record of income and spending. The multilingual interface supports different language preferences, while period-based reports turn individual entries into an overview of recorded financial activity.

## Implemented Features

| Capability | Functionality |
| --- | --- |
| Income and expense tracking | Records transaction type, amount, category, date, and an optional note. |
| Multiple input methods | Supports menu-driven entry, direct commands, and `+` / `-` shortcuts. |
| Financial summaries | Reports total income, total expenses, net recorded balance, and transaction count. |
| Reporting periods | Supports daily, weekly, monthly, yearly, and all-time summaries. |
| Transaction history | Retrieves recent entries or entries matching a date or supported period. |
| Entry correction | Deletes the most recently created transaction after confirmation. |
| Multilingual interaction | Provides Arabic, Russian, and English interface text. |
| User preferences | Persists the selected language and currency display setting. |
| Persistent storage | Stores users and transactions in MongoDB. |

Currency selection controls how amounts are displayed; it does not convert exchange rates or maintain separate balances for different currencies. The reported balance is recorded income minus recorded expenses, rather than a bank-account balance.

## Example User Journey

### 1. Record financial activity

After starting the bot and selecting their preferences, a user can enter transactions directly:

```text
/income 20000 salary
/expense 1200 food
/expense 300 transport
```

For faster entry, the application also accepts shortcuts. These are alternative ways to enter a transaction, not additional steps in the example:

```text
+ 20000 salary
- 1200 food
```

Alternatively, the user can select an income or expense button and then send the transaction details. The application remembers the expected transaction type during that input step.

### 2. Review a monthly summary

```text
/report_month
```

If the first three example transactions fall within the selected month, the expected summary is:

| Metric | Amount / count |
| --- | ---: |
| Total income | 20,000 RUB |
| Total expenses | 1,500 RUB |
| Net recorded balance | 18,500 RUB |
| Transactions | 3 |

These figures are illustrative, not measured results from a live deployment.

### 3. Add a past transaction

```text
/expense 450 books 2026-10-15 course materials
```

This records an expense in the `books` category with a transaction date of 15 October 2026 and the note `course materials`. The transaction date is stored separately from the time the record was created, allowing delayed entry without losing its intended reporting period.

### 4. Correct an accidental entry

The user can request deletion of the last added transaction and confirm or cancel the action. “Last added” refers to the record's creation time, which may differ from its transaction date.

## Architecture and Technology

The application separates three responsibilities:

| Layer | Responsibility |
| --- | --- |
| Telegram interaction | Handles commands, buttons, input parsing, temporary conversation state, and response formatting. |
| Application services | Coordinates user registration, transaction creation and deletion, history retrieval, and reporting. |
| Data access | Encapsulates database reads, writes, and aggregation through repositories and models. |

Repositories are passed into application services instead of embedding database queries in every message handler. The different transaction entry methods use the same transaction-saving service, reducing duplication and providing a common place to maintain business logic.

| Technology | Role |
| --- | --- |
| TypeScript | Defines application types and contracts between components. |
| Node.js | Runs the backend application. |
| grammY | Integrates Telegram commands, messages, buttons, and conversation state. |
| MongoDB | Persists users and transactions and performs report aggregation. |
| Mongoose | Defines document schemas, validation rules, and database models. |
| Environment variables | Supply deployment-specific configuration, including bot and database credentials. |

### Transaction processing

A message handler identifies the operation and parses the transaction details. The application retrieves the user by Telegram identity, associates the transaction with the user's internal database identifier, and saves the record. A response is then formatted using the user's language and currency preferences.

### Report generation

The service determines the requested period and asks the repository to aggregate matching transactions for that user. Income and expenses are summed separately, and the result is returned for display. Aggregation occurs in the database, so report calculation does not depend on the number of entries displayed in a history message.

## Data Model

| Entity | Main stored information | Design purpose |
| --- | --- | --- |
| User | Unique Telegram identifier, available profile information, language, currency, creation and update timestamps | Connects the sender's identity with persistent preferences and transaction ownership. |
| Transaction | User reference, income/expense type, amount, category, optional note, transaction date, creation and update timestamps | Represents a financial entry and supports user-specific history and time-based reporting. |

The transaction model restricts the operation type to income or expense, requires a category and date, and sets a minimum amount of `0.01`. Indexes on the user reference and transaction date support the main access patterns. These are structural design choices, not claims of benchmarked performance.

## Engineering Decisions

### Consistent logic across input methods

Menu entry, commands, and shortcuts converge on shared services. This keeps transaction persistence consistent while allowing different interaction styles.

### Separation of transaction date and entry time

Reports use the financial event's date, while deletion of the last added entry uses creation order. This supports retrospective entry without confusing the two concepts.

### User-specific queries

History, reports, and deletion operations resolve the requesting user and restrict database operations to that user's records. This establishes logical data separation within the application.

### Validation and clear feedback

Input parsing checks the required amount and category, supports decimal commas and decimal points, and checks explicitly supplied dates for calendar validity. Confirmation messages help users review saved entries, and deletion requires an explicit decision.

### Persistent records with temporary interaction state

Transactions and settings remain in the database. In-progress conversation steps use memory in the current implementation, so a restart may interrupt an unfinished input step without removing previously saved transactions.

## Software Engineering Value

The project provides a practical basis for discussing several areas of software engineering:

- **Requirements and interaction design:** translating a daily need into commands, guided entry, reports, and correction flows.
- **Backend architecture:** separating platform-specific handlers, application services, and data access.
- **Database modelling:** expressing ownership, required fields, transaction types, and time-related information.
- **Data processing:** filtering and aggregating records into period-based summaries.
- **Internationalisation:** presenting a common application workflow in three languages.
- **Reliability planning:** identifying validation rules, state-management limitations, and the tests needed for further development.

For an academic portfolio, the main outcome is a connected implementation that takes a user request through processing and persistent storage to an understandable result. The project also provides a foundation for further study of software testing, maintainability, database systems, and user-centred application development.

## Current Scope and Limitations

The documented version implements the features above. It does not yet include spreadsheet export, receipt processing, or separate personal and family expense scopes.

- Categories are read as a single word in the current text input format; longer details can be placed in the note.
- History displays five entries by default and caps a single retrieval at twenty. Aggregate reports are not limited to those displayed entries.
- Weekly reporting uses Monday as the start of the week. Time-zone handling needs further standardisation across history and reports.
- Currency is a user-level display preference, not a property of each transaction.
- Further work is needed on monetary precision, automated regression tests, and persistent conversation sessions.

This description is based on the supplied source version. It does not claim independently verified production availability, adoption figures, financial outcomes, or performance benchmarks.

## Development Roadmap

| Priority | Planned work | Intended benefit |
| --- | --- | --- |
| 1 | Automated tests for report calculations, period boundaries, invalid dates, user separation, and deletion | Make core behaviour reproducible and protect it against regressions. |
| 2 | Consistent time-zone handling and a more precise monetary representation | Improve the reliability of financial and date-based calculations. |
| 3 | Persistent input sessions and backup/recovery procedures | Improve resilience during restarts and operational failures. |
| 4 | Personal/family expense scopes, spreadsheet export, and category summaries | Extend the usefulness of recorded financial data. |
| 5 | A small usability study measuring entry time, task completion, and report clarity | Evaluate practical usefulness with evidence. |

These are proposed extensions and evaluation activities, not completed results.
