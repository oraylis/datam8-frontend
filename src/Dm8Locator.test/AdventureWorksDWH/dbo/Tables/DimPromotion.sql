CREATE TABLE [dbo].[DimPromotion] (
    [PromotionKey]             INT            IDENTITY (1, 1) NOT NULL,
    [PromotionAlternateKey]    INT            NULL,
    [EnglishPromotionName]     NVARCHAR (255) NULL,
    [SpanishPromotionName]     NVARCHAR (255) NULL,
    [FrenchPromotionName]      NVARCHAR (255) NULL,
    [DiscountPct]              FLOAT (53)     NULL,
    [EnglishPromotionType]     NVARCHAR (50)  NULL,
    [SpanishPromotionType]     NVARCHAR (50)  NULL,
    [FrenchPromotionType]      NVARCHAR (50)  NULL,
    [EnglishPromotionCategory] NVARCHAR (50)  NULL,
    [SpanishPromotionCategory] NVARCHAR (50)  NULL,
    [FrenchPromotionCategory]  NVARCHAR (50)  NULL,
    [StartDate]                DATETIME       NOT NULL,
    [EndDate]                  DATETIME       NULL,
    [MinQty]                   INT            NULL,
    [MaxQty]                   INT            NULL,
    CONSTRAINT [PK_DimPromotion_PromotionKey] PRIMARY KEY CLUSTERED ([PromotionKey] ASC),
    CONSTRAINT [AK_DimPromotion_PromotionAlternateKey] UNIQUE NONCLUSTERED ([PromotionAlternateKey] ASC)
);

