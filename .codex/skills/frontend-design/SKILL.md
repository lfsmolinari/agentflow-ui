---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
---


# frontend-design

Use this skill when turning product and UX requirements into concrete interface direction, UI specs, flows, or visual-system guidance.

This skill is inspired by strong frontend design workflows that reject generic AI aesthetics and instead commit to a clear visual point of view.

## Purpose

Help the agent produce UI/UX artifacts that are:

- distinctive without being chaotic
- minimal when appropriate, but never vague
- grounded in hierarchy, spacing, interaction states, and product intent
- useful for Architect and Coder handoff

## Workflow

### 1. Understand The Product Shape

Before proposing screens or layout:

- identify the user's goal
- identify the main workflow
- identify what the user sees first
- identify what remains persistent across screens
- identify what only appears in-context

For this repository, common examples include:

- install gate
- login choice
- empty shell
- workspace sidebar
- session restoration
- active chat
- contextual agent selector

### 2. Commit To A Clear Aesthetic Direction

Choose an intentional direction and state it plainly.

Examples:

- quiet dark desktop minimalism
- editorial productivity interface
- restrained terminal-inspired workspace
- modern native-app hierarchy

Avoid generic or overused defaults such as:

- purple-on-white AI branding
- interchangeable SaaS dashboards
- decorative cards everywhere
- typography with no personality or hierarchy

### 3. Define The Interface By Hierarchy

Always describe:

- what is primary
- what is secondary
- what stays persistent
- what changes by state
- what is discoverable but not dominant

Good UI specs make it obvious where attention should go.

### 4. Describe States, Not Just Screens

At minimum, consider:

- empty
- loading
- authenticated vs unauthenticated
- missing dependency
- active selection
- disabled options
- error or blocked states

### 5. Make Components Behavioral

Do not stop at naming parts of the interface. Explain how they behave.

Examples:

- how the agent selector appears
- when a session list changes
- how a disabled agent is explained
- where file-path context is attached

### 6. Keep It Implementation-Ready

Write so Architect and Coder can act on it.

That means:

- concrete layout guidance
- explicit states
- interaction notes
- content tone guidance
- accessibility notes when relevant

## Output Guidance

Prefer `ui-spec.md` when writing files.

A strong `ui-spec.md` usually includes:

- purpose
- users
- style
- layout
- information hierarchy
- key components
- states
- interactions
- content guidance
- accessibility notes
- notes for Architect and Coder

## Repository-Specific Guidance

For `agentflow-ui`:

- preserve the minimalism of Codex Desktop without copying it mechanically
- keep the left rail stable and calm
- make the main chat area the focal point
- place agent choice inside the composer when a session is active
- use future-agent visibility carefully so disabled states feel intentional
- design around workspaces as folders and sessions as chats within them
