# WEDOS — Wedding Event Operating & Resource Management System

WEDOS (Wedding Event Operating & Resource Management System) is an application-oriented Operating Systems mini-project that combines practical wedding event management with core Operating System concepts.

The system provides wedding planning, vendor discovery, booking management, guest management, event scheduling, expense tracking, task management, and an interactive demonstration of Operating System concepts such as CPU Scheduling, Process Management, Resource Allocation, and Synchronization.

---

## Project Status

**Development completed through Phase 12 — Final Integration, Testing & Audit**

### Completed Phases

- Phase 1 — Foundation
- Phase 2 — Database & Prisma
- Phase 3 — Authentication & Role System
- Phase 4 — Customer Dashboard & Wedding Management
- Phase 5 — Vendor Discovery & Vendor Details
- Phase 6 — Customer–Vendor Booking Workflow
- Phase 7 — Guests, Events, Budget & Tasks
- Phase 8 — CPU Scheduling
- Phase 9 — Process Management
- Phase 10 — Resource Allocation
- Phase 11 — Synchronization & Concurrent Resource Protection
- Phase 12 — Integration, Testing & Final Audit

---

## Operating System Concepts

WEDOS demonstrates four major Operating System concepts through an application-oriented wedding management scenario.

### 1. CPU Scheduling

Wedding tasks can be represented as processes and scheduled using:

- First Come First Serve (FCFS)
- Shortest Job First (SJF)
- Priority Scheduling
- Round Robin (RR)

The scheduling module provides:

- Arrival time
- Burst time
- Priority
- Completion time
- Turnaround time
- Waiting time
- Response time
- Average scheduling metrics
- Gantt chart visualization

---

### 2. Process Management

Wedding tasks can be represented as application-level processes.

The implemented process lifecycle is:

```text
NEW → READY → RUNNING → WAITING → READY → COMPLETED
