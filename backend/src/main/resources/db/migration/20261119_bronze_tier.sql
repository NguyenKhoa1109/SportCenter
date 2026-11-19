-- Enable Bronze creation from the manager UI, without pre-creating a package.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_membership_packages_tier'
        AND CHARINDEX('BRONZE', definition) = 0)
    ALTER TABLE dbo.membership_packages DROP CONSTRAINT CK_membership_packages_tier;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_membership_packages_tier')
    ALTER TABLE dbo.membership_packages ADD CONSTRAINT CK_membership_packages_tier
        CHECK (membership_tier IS NULL OR membership_tier IN ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND'));

COMMIT TRANSACTION;
