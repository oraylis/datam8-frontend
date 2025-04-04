using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows.Forms.VisualStyles;
using Dm8Data;
using Dm8Data.AttributeTypes;
using Dm8Data.Helper;
using Newtonsoft.Json;
using RestSharp;

namespace Dm8Main.Updates
{
    public class CheckDefaultEntries
    {
        public static ObservableCollection<AttributeType> AttributTypes(ObservableCollection<AttributeType> attributeTypes, out bool found)
        {
            found = attributeTypes.Any(x => x.IsDefaultProperty == true);

            if (!found)
            {
                attributeTypes.Add(new AttributeType
                {
                    Name = "Generic String",
                    DisplayName = "Generic for String",
                    DefaultType = "string",
                    CanBeInRelation = false,
                    IsDefaultProperty = true
                });
                attributeTypes.Add(new AttributeType
                {
                    Name = "Generic Datetime",
                    DisplayName = "Generic for Datetime",
                    DefaultType = "datetime",
                    CanBeInRelation = false,
                    IsDefaultProperty = true
                });
                attributeTypes.Add(new AttributeType
                {
                    Name = "Generic Date",
                    DisplayName = "Generic for Date",
                    DefaultType = "date",
                    CanBeInRelation = false,
                    IsDefaultProperty = true
                });
                attributeTypes.Add(new AttributeType
                {
                    Name = "Generic Int",
                    DisplayName = "Generic for Int",
                    DefaultType = "int",
                    CanBeInRelation = true,
                    IsDefaultProperty = true
                });
                attributeTypes.Add(new AttributeType
                {
                    Name = "Generic Double",
                    DisplayName = "Generic for Double",
                    DefaultType = "double",
                    CanBeInRelation = false,
                    IsDefaultProperty = true
                });

            }
            return(attributeTypes);
        }

        public static Dm8Data.Solution Solution(string content, ref bool reWriteFile)
        {
            Dm8Data.Solution solution = new Solution();

            bool loop = true;
            while (loop)
            {
                try
                {
                    solution = JsonConvert.DeserializeObject<Dm8Data.Solution>(content);
                    loop = false;
                }
                catch
                {
                    Solution s = new Solution();
                    content = FileHelper.MakeJson(s);
                    reWriteFile = true;
                    //string v = ex.Message;
                    //if (v.Contains("AreaTypes"))
                    //{
                    //    int pos = content.LastIndexOf("}", StringComparison.InvariantCultureIgnoreCase);
                    //    content = content.Substring(0, pos)
                    //             + ",AreaTypes: {Raw: \"Raw\",Stage: \"Stage\",Core: \"Core\",Curated: \"Curated\",Diagram: \"Diagram\"}"
                    //             + Environment.NewLine
                    //             + "}";
                    //    reWriteFile = true;
                    //}

                    //if (!reWriteFile)
                    //{
                    //    throw ex;
                    //}
                }
            }
            return (solution);
        }
    }
}
