# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

wordmemory — a browser-side word memorization app with no backend. Everything runs client-side with localStorage persistence.

Core modules:
- **Word memory**: randomly pick N words from a word bank, user marks "know" or "don't know", unknown words go to the error word book
- **Word quiz**: randomly pick words (biased toward error word book), user types the definition, synonyms count as correct
- **Error word book**: view all mistaken/unknown words, sort by error count or last error time, with a clear-all button
- **Extensibility**: dropping a new JSON file into the word data folder auto-maps it as a new word sub-module in the UI

## Tech Stack (to be decided in SDD phase)

This is a greenfield project. No framework decisions have been made yet. The requirements doc (需求.md) specifies a five-phase plan:

1. **SDD** — software detailed design: choose framework/architecture, storage strategy, component tree, API contracts, edge cases, directory structure
2. **Spec** — structured spec: precise constraints per feature, normal + edge cases, coding standards
3. **Write-plans** — step-by-step dev plan split into independent steps with risk notes
4. **Execute-plan** — implement strictly per plan, one step at a time
5. **TDD** — full test suite covering normal + edge cases, with red-green logs

## Key Constraints

- No backend — all data lives in browser localStorage as JSON
- Word bank data is file-based (JSON files in a word data folder)
- Adding a new JSON file to that folder should auto-register as a new module in the frontend
- Synonyms are treated as correct answers in quiz mode
- Error words track both count and timestamp for sorting

## Installed Skills

- `ui-ux-pro-max` and related CKM skills (banner-design, brand, design, design-system, slides, ui-styling) — UI/UX design system

## Requirements Document

All detailed requirements are in `需求.md` (Chinese). Refer to it for feature specs, acceptance criteria, and the full phase-by-phase deliverables table.
