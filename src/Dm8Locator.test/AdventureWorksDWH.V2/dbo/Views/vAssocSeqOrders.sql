/* vAssocSeqOrders supports assocation and sequence clustering data mmining models.
      - Limits data to FY2004.
      - Creates order case table and line item nested table.*/
CREATE VIEW [dbo].[vAssocSeqOrders]
AS
SELECT DISTINCT OrderNumber, CustomerKey, Region, IncomeGroup
FROM         dbo.vDMPrep
WHERE     (FiscalYear = '2013')

