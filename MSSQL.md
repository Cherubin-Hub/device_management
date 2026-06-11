# MSSQL Migration Guide

This is the single main Microsoft SQL Server reference for the project. Use it when you want to move the database from Supabase PostgreSQL to MSSQL.

> Important: Do not run this script in the Supabase SQL Editor. It uses SQL Server syntax such as `IDENTITY(1,1)`, `NVARCHAR`, `BIT`, `DATETIME2`, and `dbo.`. For Supabase PostgreSQL, run the script in `SUPABASE.md` instead.

## 1. Important Architecture Rule

Do not connect the React/Vite frontend directly to MSSQL. Browser apps expose frontend code and environment variables, so direct MSSQL credentials would become unsafe.

Recommended architecture:

```text
React/Vite Frontend -> Backend API -> MSSQL Database
```

Good backend options:

- Node.js with Express or NestJS.
- .NET Web API.
- Next.js API routes.
- Any secure server that can keep MSSQL credentials private.

## 2. Migration Steps From Supabase To MSSQL

1. Create a backend API project.
2. Create the MSSQL database.
3. Run the schema script below.
4. Export Supabase data as CSV.
5. Import CSV data into MSSQL staging tables.
6. Validate row counts between Supabase and MSSQL.
7. Build API endpoints matching current frontend workflows.
8. Replace Supabase frontend calls with API calls.
9. Replace Supabase Auth with your selected login provider.
10. Test all modules before switching production traffic.

## 3. Full MSSQL Schema Script

This script mirrors the current Supabase schema. The script is written in study mode: schema lines include inline comments, and structural lines have nearby comments explaining why they exist.

```sql
/*
====================================================
Purpose : Create MSSQL schema for Endivio Device
          Management migration
Module  : All Modules
Database: Microsoft SQL Server
Date    : 2026-06-09
====================================================
*/

-- Create client lookup table used by inventory and testing records.
CREATE TABLE dbo.Clients (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Clients PRIMARY KEY, -- Unique client row identifier.
    Name NVARCHAR(255) NOT NULL, -- Full client/company name.
    ClientCode NVARCHAR(100) NOT NULL, -- Unique short client code shown in records.
    IsActive BIT NOT NULL CONSTRAINT DF_Clients_IsActive DEFAULT (1), -- Controls if client is available for selection.
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Clients_CreatedAt DEFAULT (SYSUTCDATETIME()) -- Date/time created.
); -- End of Clients table definition.

-- Prevent duplicate client codes.
CREATE UNIQUE INDEX UX_Clients_ClientCode
ON dbo.Clients (ClientCode); -- Index ClientCode so duplicate client codes are blocked.

-- Create status lookup table used by inventory and testing records.
CREATE TABLE dbo.Statuses (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Statuses PRIMARY KEY, -- Unique status row identifier.
    Name NVARCHAR(150) NOT NULL, -- Status label shown to users.
    Color NVARCHAR(20) NOT NULL CONSTRAINT DF_Statuses_Color DEFAULT ('#4b5563'), -- Hex color used by status chips.
    IsActive BIT NOT NULL CONSTRAINT DF_Statuses_IsActive DEFAULT (1), -- Controls if status is available for selection.
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Statuses_CreatedAt DEFAULT (SYSUTCDATETIME()) -- Date/time created.
); -- End of Statuses table definition.

-- Prevent duplicate status names.
CREATE UNIQUE INDEX UX_Statuses_Name
ON dbo.Statuses (Name); -- Index Name so duplicate status labels are blocked.

-- Create device type lookup table used by inventory records.
CREATE TABLE dbo.DeviceTypes (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DeviceTypes PRIMARY KEY, -- Unique device type row identifier.
    Name NVARCHAR(150) NOT NULL, -- Device type/model label shown in inventory selection.
    IsActive BIT NOT NULL CONSTRAINT DF_DeviceTypes_IsActive DEFAULT (1), -- Controls if device type is available for selection.
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DeviceTypes_CreatedAt DEFAULT (SYSUTCDATETIME()) -- Date/time created.
); -- End of DeviceTypes table definition.

-- Prevent duplicate device type names.
CREATE UNIQUE INDEX UX_DeviceTypes_Name
ON dbo.DeviceTypes (Name); -- Index Name so duplicate device types are blocked.

-- Create main inventory table.
CREATE TABLE dbo.DeviceInventoryItems (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DeviceInventoryItems PRIMARY KEY, -- Unique inventory record identifier.
    Company NVARCHAR(255) NULL, -- Company/client display name retained for reports.
    ClientId BIGINT NULL, -- Linked client id.
    RaisedBy NVARCHAR(255) NULL, -- Person who raised or encoded the record.
    DateReceived DATE NULL, -- Date the device was received.
    PackageStyle NVARCHAR(100) NULL, -- Package style such as With Box or Plastic.
    CstNumber NVARCHAR(100) NULL, -- CST reference number.
    TicketNumber NVARCHAR(100) NULL, -- Support ticket number.
    SnNumber NVARCHAR(150) NULL, -- Device serial number.
    DeviceType NVARCHAR(150) NULL, -- Device model/type.
    WithAdapter NVARCHAR(20) NULL, -- Indicates if the adapter is included.
    StartRepairingSupport DATE NULL, -- Repair/support start date.
    EndDateSupport DATE NULL, -- Repair/support end date.
    StartQa DATE NULL, -- QA start date.
    EndDateQa DATE NULL, -- QA end date.
    StatusId BIGINT NULL, -- Linked status id.
    DateDelivered DATE NULL, -- Date the device was delivered.
    GiveTo NVARCHAR(255) NULL, -- Person who received the device.
    Remarks NVARCHAR(MAX) NULL, -- Free-form notes and issue details.
    SourceOngoingId BIGINT NULL, -- Source ongoing testing id after transfer.
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DeviceInventoryItems_CreatedAt DEFAULT (SYSUTCDATETIME()), -- Date/time created.
    UpdatedAt DATETIME2(0) NULL, -- Date/time last updated.
    CONSTRAINT FK_DeviceInventoryItems_Clients FOREIGN KEY (ClientId) REFERENCES dbo.Clients(Id) ON DELETE SET NULL, -- Keep record if client is removed.
    CONSTRAINT FK_DeviceInventoryItems_Statuses FOREIGN KEY (StatusId) REFERENCES dbo.Statuses(Id) ON DELETE SET NULL -- Keep record if status is removed.
); -- End of DeviceInventoryItems table definition.

-- Improve client filtering in inventory.
CREATE INDEX IX_DeviceInventoryItems_ClientId
ON dbo.DeviceInventoryItems (ClientId); -- Index ClientId for client-based inventory filtering.

-- Improve status filtering in inventory.
CREATE INDEX IX_DeviceInventoryItems_StatusId
ON dbo.DeviceInventoryItems (StatusId); -- Index StatusId for status-based inventory filtering.

-- Improve date range filtering in inventory.
CREATE INDEX IX_DeviceInventoryItems_DateReceived
ON dbo.DeviceInventoryItems (DateReceived); -- Index DateReceived for inventory date range filters.

-- Create ongoing testing table.
CREATE TABLE dbo.OngoingTestingItems (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OngoingTestingItems PRIMARY KEY, -- Unique testing record identifier.
    ClientId BIGINT NULL, -- Linked client id.
    DateReceived DATE NULL, -- Date the testing item was received.
    PackageStyle NVARCHAR(100) NULL, -- Package style of the received device.
    PictureUrl NVARCHAR(1000) NULL, -- URL for package image storage.
    Model NVARCHAR(150) NULL, -- Device model under testing.
    WithAdapter NVARCHAR(20) NULL, -- Indicates if adapter is included.
    SerialNumber NVARCHAR(150) NULL, -- Device serial number.
    StartRepairingSupport DATE NULL, -- Support start date copied from inventory for generated testing rows.
    EndDateSupport DATE NULL, -- Support end date copied from inventory for warning and overdue colors.
    StartQa DATE NULL, -- QA start date copied from inventory for generated testing rows.
    EndDateQa DATE NULL, -- QA end date copied from inventory for completed workflow state.
    StatusId BIGINT NULL, -- Linked testing status id.
    RepairBy NVARCHAR(255) NULL, -- Assigned repair person.
    TestBy NVARCHAR(255) NULL, -- Assigned tester.
    SeniorTestBy NVARCHAR(255) NULL, -- Assigned senior tester or reviewer.
    Remarks NVARCHAR(MAX) NULL, -- Testing notes and issue details.
    SourceInventoryId BIGINT NULL, -- Source inventory id after transfer back.
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OngoingTestingItems_CreatedAt DEFAULT (SYSUTCDATETIME()), -- Date/time created.
    UpdatedAt DATETIME2(0) NULL, -- Date/time last updated.
    CONSTRAINT FK_OngoingTestingItems_Clients FOREIGN KEY (ClientId) REFERENCES dbo.Clients(Id) ON DELETE SET NULL, -- Keep record if client is removed.
    CONSTRAINT FK_OngoingTestingItems_Statuses FOREIGN KEY (StatusId) REFERENCES dbo.Statuses(Id) ON DELETE SET NULL -- Keep record if status is removed.
); -- End of OngoingTestingItems table definition.

-- Improve client filtering in ongoing testing.
CREATE INDEX IX_OngoingTestingItems_ClientId
ON dbo.OngoingTestingItems (ClientId); -- Index ClientId for client-based testing filtering.

-- Improve status filtering in ongoing testing.
CREATE INDEX IX_OngoingTestingItems_StatusId
ON dbo.OngoingTestingItems (StatusId); -- Index StatusId for status-based testing filtering.

-- Improve date range filtering in ongoing testing.
CREATE INDEX IX_OngoingTestingItems_DateReceived
ON dbo.OngoingTestingItems (DateReceived); -- Index DateReceived for testing date range filters.

-- Prevent multiple generated testing rows for the same inventory record.
CREATE UNIQUE INDEX UX_OngoingTestingItems_SourceInventoryId
ON dbo.OngoingTestingItems (SourceInventoryId) -- Link one generated testing row to one inventory row.
WHERE SourceInventoryId IS NOT NULL; -- Allow older/manual rows with no source inventory id.

-- Add support start date to existing MSSQL projects that already created OngoingTestingItems.
IF COL_LENGTH('dbo.OngoingTestingItems', 'StartRepairingSupport') IS NULL
    ALTER TABLE dbo.OngoingTestingItems ADD StartRepairingSupport DATE NULL; -- Add support start date for generated testing rows.

-- Add support due date to existing MSSQL projects that already created OngoingTestingItems.
IF COL_LENGTH('dbo.OngoingTestingItems', 'EndDateSupport') IS NULL
    ALTER TABLE dbo.OngoingTestingItems ADD EndDateSupport DATE NULL; -- Add support due date for green/orange/red row colors.

-- Add QA start date to existing MSSQL projects that already created OngoingTestingItems.
IF COL_LENGTH('dbo.OngoingTestingItems', 'StartQa') IS NULL
    ALTER TABLE dbo.OngoingTestingItems ADD StartQa DATE NULL; -- Add QA start date for generated testing rows.

-- Add QA end date to existing MSSQL projects that already created OngoingTestingItems.
IF COL_LENGTH('dbo.OngoingTestingItems', 'EndDateQa') IS NULL
    ALTER TABLE dbo.OngoingTestingItems ADD EndDateQa DATE NULL; -- Add QA end date for generated testing rows.

-- Create repair workflow table generated from inventory records.
CREATE TABLE dbo.RepairDeviceRecords (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RepairDeviceRecords PRIMARY KEY, -- Unique repair workflow row identifier.
    SourceInventoryId BIGINT NULL, -- Inventory row that generated this repair task.
    Company NVARCHAR(255) NULL, -- Company/client display name copied from inventory.
    ClientId BIGINT NULL, -- Linked client id.
    ClientCode NVARCHAR(100) NULL, -- Client code copied from inventory.
    DateReceived DATE NULL, -- Date received copied from inventory.
    PackageStyle NVARCHAR(100) NULL, -- Package style copied from inventory.
    CstNumber NVARCHAR(100) NULL, -- CST number copied from inventory.
    TicketNumber NVARCHAR(100) NULL, -- Ticket number copied from inventory.
    SnNumber NVARCHAR(150) NULL, -- Device serial number copied from inventory.
    DeviceType NVARCHAR(150) NULL, -- Device type copied from inventory.
    WithAdapter NVARCHAR(20) NULL, -- Adapter flag copied from inventory.
    WorkflowStatus NVARCHAR(100) NOT NULL CONSTRAINT DF_RepairDeviceRecords_WorkflowStatus DEFAULT ('Repair By'), -- Current repair workflow stage.
    AssignedTo UNIQUEIDENTIFIER NULL, -- User id currently handling the repair task.
    AssignedToEmail NVARCHAR(255) NULL, -- User email currently handling the repair task.
    AssignedAt DATETIME2(0) NULL, -- Date/time when the task was claimed.
    DeviceAlgorithm NVARCHAR(150) NULL, -- Device algorithm/version encoded during checking.
    DevicePinwidth NVARCHAR(100) NULL, -- Current pinwidth encoded during checking.
    PreviousPinwidth NVARCHAR(100) NULL, -- Previous pinwidth encoded during checking.
    CheckingRemarks NVARCHAR(MAX) NULL, -- General checking remarks.
    TestResults NVARCHAR(MAX) NOT NULL CONSTRAINT DF_RepairDeviceRecords_TestResults DEFAULT ('[]'), -- JSON checklist results.
    RepairBy NVARCHAR(255) NULL, -- User/name who claimed the repair task.
    TestBy NVARCHAR(255) NULL, -- User/name who completed testing.
    SeniorTestBy NVARCHAR(255) NULL, -- User/name who completed senior/supervisor checking.
    AdditionalComments NVARCHAR(MAX) NULL, -- Additional final comments.
    CompletedAt DATETIME2(0) NULL, -- Date/time supervisor checking completed.
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RepairDeviceRecords_CreatedAt DEFAULT (SYSUTCDATETIME()), -- Date/time created.
    UpdatedAt DATETIME2(0) NULL, -- Date/time last updated.
    CONSTRAINT FK_RepairDeviceRecords_Inventory FOREIGN KEY (SourceInventoryId) REFERENCES dbo.DeviceInventoryItems(Id) ON DELETE CASCADE, -- Delete repair task when source inventory is deleted.
    CONSTRAINT FK_RepairDeviceRecords_Clients FOREIGN KEY (ClientId) REFERENCES dbo.Clients(Id) ON DELETE SET NULL -- Keep repair task if client is removed.
); -- End of RepairDeviceRecords table definition.

-- Prevent duplicate repair workflow rows for one inventory record.
CREATE UNIQUE INDEX UX_RepairDeviceRecords_SourceInventoryId
ON dbo.RepairDeviceRecords (SourceInventoryId) -- Link one repair workflow row to one inventory row.
WHERE SourceInventoryId IS NOT NULL; -- Allow manually imported historical rows with no source inventory id.

-- Improve queue filtering by workflow status.
CREATE INDEX IX_RepairDeviceRecords_WorkflowStatus
ON dbo.RepairDeviceRecords (WorkflowStatus); -- Index workflow status for New and Done repair pages.

-- Improve My Repair Device filtering by assigned user email.
CREATE INDEX IX_RepairDeviceRecords_AssignedToEmail
ON dbo.RepairDeviceRecords (AssignedToEmail); -- Index assigned email for the user's task list.

-- Add Repair By to existing MSSQL repair workflow tables.
IF COL_LENGTH('dbo.RepairDeviceRecords', 'RepairBy') IS NULL
    ALTER TABLE dbo.RepairDeviceRecords ADD RepairBy NVARCHAR(255) NULL; -- Stores who clicked Get This Repair.

-- Add Tested By to existing MSSQL repair workflow tables.
IF COL_LENGTH('dbo.RepairDeviceRecords', 'TestBy') IS NULL
    ALTER TABLE dbo.RepairDeviceRecords ADD TestBy NVARCHAR(255) NULL; -- Stores who completed the testing stage.

-- Add Senior Tested By to existing MSSQL repair workflow tables.
IF COL_LENGTH('dbo.RepairDeviceRecords', 'SeniorTestBy') IS NULL
    ALTER TABLE dbo.RepairDeviceRecords ADD SeniorTestBy NVARCHAR(255) NULL; -- Stores who completed senior/supervisor checking.

-- Create archive table for deleted records.
CREATE TABLE dbo.ArchivedRecords (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ArchivedRecords PRIMARY KEY, -- Unique archive record identifier.
    SourceTable NVARCHAR(100) NOT NULL, -- Original table where record came from.
    RecordType NVARCHAR(100) NOT NULL, -- User-friendly record type.
    RecordLabel NVARCHAR(255) NULL, -- Human-readable record identifier.
    RecordData NVARCHAR(MAX) NOT NULL, -- JSON payload for restoring the record.
    ArchivedBy UNIQUEIDENTIFIER NULL, -- User id that archived the record.
    ArchivedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ArchivedRecords_ArchivedAt DEFAULT (SYSUTCDATETIME()), -- Date/time archived.
    CONSTRAINT CK_ArchivedRecords_SourceTable CHECK (SourceTable IN ('device_inventory_items', 'ongoing_testing_items')) -- Restrict restore source tables.
); -- End of ArchivedRecords table definition.

-- Improve archive page sorting by newest archive.
CREATE INDEX IX_ArchivedRecords_ArchivedAt
ON dbo.ArchivedRecords (ArchivedAt DESC); -- Index ArchivedAt so newest deleted records load first.

-- Create audit table for movement history.
CREATE TABLE dbo.AuditTrail (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditTrail PRIMARY KEY, -- Unique audit event identifier.
    EventTime DATETIME2(0) NOT NULL CONSTRAINT DF_AuditTrail_EventTime DEFAULT (SYSUTCDATETIME()), -- Date/time event happened.
    Module NVARCHAR(150) NOT NULL, -- Application module that created the event.
    Action NVARCHAR(100) NOT NULL, -- Action such as CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, or TRANSFER.
    EntityTable NVARCHAR(150) NOT NULL, -- Table affected by the event.
    EntityId NVARCHAR(100) NULL, -- Affected record id.
    RecordLabel NVARCHAR(255) NULL, -- Human-readable record identifier.
    ActorId UNIQUEIDENTIFIER NULL, -- User id from the future auth provider.
    ActorEmail NVARCHAR(255) NULL, -- User email from the future auth provider.
    Summary NVARCHAR(MAX) NULL, -- User-friendly movement summary.
    BeforeData NVARCHAR(MAX) NULL, -- JSON snapshot before change.
    AfterData NVARCHAR(MAX) NULL, -- JSON snapshot after change.
    Metadata NVARCHAR(MAX) NULL -- Extra JSON context for movement events.
); -- End of AuditTrail table definition.

-- Improve required date range filtering in audit reports.
CREATE INDEX IX_AuditTrail_EventTime
ON dbo.AuditTrail (EventTime DESC); -- Index EventTime because audit reports require a date range.

-- Improve investigation of movement for one record.
CREATE INDEX IX_AuditTrail_Entity
ON dbo.AuditTrail (EntityTable, EntityId); -- Index EntityTable and EntityId for record movement investigation.

-- Seed default statuses used by the application workflow.
INSERT INTO dbo.Statuses (Name, Color)
SELECT Seed.Name, Seed.Color
FROM (VALUES
    ('Completed', '#00d000'), -- Closed testing status.
    ('N/A', '#475569'), -- Closed testing status.
    ('Ongoing Support', '#f59e0b'), -- Automatic inventory status when Start Repairing Support has a value.
    ('Overdue Support', '#dc2626'), -- Automatic inventory status when support end date has passed and QA has not started.
    ('Ongoing QA', '#2563eb'), -- Automatic inventory status when Start QA has a value.
    ('Ongoing Repair', '#fb923c'), -- Active repair status.
    ('Cancelled', '#dc2626'), -- Cancelled status.
    ('Deployed', '#00d000') -- Inventory deployed status.
) AS Seed(Name, Color) -- Name the seed columns so the SELECT above can reference them clearly.
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Statuses Existing
    WHERE Existing.Name = Seed.Name
); -- End of default status seed block.

-- Seed default device types used by the inventory Device Type selector.
INSERT INTO dbo.DeviceTypes (Name)
SELECT Seed.Name
FROM (VALUES
    ('T10K'), -- Common biometric device model.
    ('T2200'), -- Common biometric device model.
    ('FaceID 1500') -- Common face recognition device model.
) AS Seed(Name) -- Name the seed column so the SELECT above can reference it clearly.
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.DeviceTypes Existing
    WHERE Existing.Name = Seed.Name
); -- End of default device type seed block.
```

## 4. Backend API Mapping

When migrating to MSSQL, replace Supabase calls with backend endpoints.

| Current Supabase Area | Suggested API Endpoint |
| --- | --- |
| `clients` | `GET/POST/PUT/DELETE /api/clients` |
| `statuses` | `GET/POST/PUT/DELETE /api/statuses` |
| `device_types` | `GET/POST/PUT/DELETE /api/device-types` |
| `device_inventory_items` | `GET/POST/PUT/DELETE /api/inventory-records` |
| `ongoing_testing_items` | `GET/POST/PUT/DELETE /api/ongoing-testing` |
| `archived_records` | `GET/POST/DELETE /api/archives` |
| `audit_trail` | `GET/POST /api/audit-trail` |
| Supabase Storage | Use Azure Blob Storage, S3, or server file upload endpoint |
| Supabase Auth | Use backend JWT auth, Azure AD, Auth0, or another auth provider |

## 5. Sample Backend Query Pattern

Use parameterized SQL only. Never concatenate user input into SQL strings.

```sql
/*
====================================================
Purpose : Get audit events by required date range
Module  : Audit Trail
Database: Microsoft SQL Server
====================================================
*/

CREATE OR ALTER PROCEDURE dbo.GetAuditTrailByDateRange
    @DateFrom DATETIME2(0), -- Required start date/time.
    @DateTo DATETIME2(0) -- Required end date/time.
AS
BEGIN
    -- Prevent noisy row count messages in API responses.
    SET NOCOUNT ON;

    -- Return only events inside the requested date range.
    SELECT
        Id, -- Audit event id.
        EventTime, -- Event timestamp.
        Module, -- Application module.
        Action, -- Event action.
        EntityTable, -- Affected table.
        EntityId, -- Affected record id.
        RecordLabel, -- User-friendly record label.
        ActorEmail, -- User who performed the action.
        Summary -- Report summary.
    FROM dbo.AuditTrail -- Read from the audit history table.
    WHERE EventTime >= @DateFrom
      AND EventTime <= @DateTo
    ORDER BY EventTime DESC; -- Show newest audit movement first.
END;
```

## 6. Rollback Instructions

Run this only after exporting any data you need to keep.

```sql
/*
====================================================
Purpose : Roll back MSSQL schema for Endivio Device
          Management
Module  : Database Rollback
Database: Microsoft SQL Server
====================================================
*/

-- Drop child/history tables first.
DROP TABLE IF EXISTS dbo.AuditTrail;

-- Drop archived records after audit trail.
DROP TABLE IF EXISTS dbo.ArchivedRecords;

-- Drop repair workflow records before inventory because they reference inventory rows.
DROP TABLE IF EXISTS dbo.RepairDeviceRecords;

-- Drop ongoing testing before lookup tables.
DROP TABLE IF EXISTS dbo.OngoingTestingItems;

-- Drop inventory before lookup tables.
DROP TABLE IF EXISTS dbo.DeviceInventoryItems;

-- Drop statuses after dependent records.
DROP TABLE IF EXISTS dbo.Statuses;

-- Drop device types after dependent records.
DROP TABLE IF EXISTS dbo.DeviceTypes;

-- Drop clients after dependent records.
DROP TABLE IF EXISTS dbo.Clients;
```

## 7. Change Log

| Date | Change Description | Developer Notes |
| --- | --- | --- |
| 2026-06-09 | Rebuilt MSSQL guide as migration-ready documentation. | Mirrors the active Supabase schema and explains API migration steps. |
| 2026-06-09 | Added fully commented MSSQL schema script. | Helps future migration without exposing MSSQL credentials in the frontend. |
| 2026-06-09 | Added configurable device types. | Mirrors the Supabase `device_types` setup for future MSSQL migration. |
| 2026-06-10 | Added automatic inventory workflow statuses. | Mirrors automatic Inventory Records status logic for future MSSQL migration. |
| 2026-06-10 | Added Testing Device repair workflow. | Mirrors the new repair queue, assignment, checking, and completion process. |

## 8. Developer Notes

- The frontend must be changed from Supabase client calls to backend API calls before MSSQL can be used safely.
- MSSQL JSON fields are represented as `NVARCHAR(MAX)` in this guide.
- Authentication must be replaced because Supabase Auth is tied to Supabase.
- File upload must be replaced because Supabase Storage is tied to Supabase.
- Inventory status is automatic and depends on support/QA dates, so keep the required status names seeded.
- Testing Device workflow stages are `Repair By`, `Tested By`, `Senior Tested By`, and `Done Repair Device`.
