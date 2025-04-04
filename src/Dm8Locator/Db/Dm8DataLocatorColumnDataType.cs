namespace Dm8Locator.Db
{    
    public enum Dm8DataLocatorColumnDataType
    /// <summary>
    /// Enum of internal data types
    /// </summary>
    {
        NONE = 0,
        Null = 1,
        Bool = 2,

        // integers
        Int8 = 10,
        Int16 = 11,
        Int32 = 12,
        Int64 = 13,

        // strings
        Utf8 = 20,
        Utf16 = 21,
        Utf32 = 22,

        // Floating and Decimal
        Double = 30,
        Float = 31,
        Decimal = 32,
        Numeric = 33,

        // date time
        Date = 40,
        Time = 41,
        Timestamp = 42,

        // binary
        Binary = 50
    }

}
