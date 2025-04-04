using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.DataSources;
using Dm8PluginBase.Interfaces;
using CategoryAttribute = PropertyTools.DataAnnotations.CategoryAttribute;

namespace Dm8Main.Models
{
    [DisplayName("Data Source")]
    public class DataSourceInfo
    {
        private DataSource _owner;

        [CategoryAttribute("Naming")]
        [Display(Name = "Name", Description = "Name of Data Source")]
        public string Name
        {
            get
            {
                return (_owner?.Name);
            }
            set
            {
                _owner.Name = value;
            }
        }
        [Display(Name = "Display Name", Description = "Displayname of Data Source")]
        public string DisplayName
        {
            get { return (_owner?.DisplayName); }
            set { _owner.DisplayName = value; }
        }
        [Display(Name = "Purpuse", Description = "Purpose of Data Source")]
        public string Purpose
        {
            get { return (_owner?.Purpose); }
            set { _owner.Purpose = value; }
        }

        [CategoryAttribute("Info")]
        [ReadOnly(true)]
        [Display(Name = "Type", Description = "Type of Data Source")]
        public string Type
        {
            get
            {
                return (_owner?.Type);
            }
        }
        [Display(Name = "Connection String", Description = "")]
        [ReadOnly(true)]
        public string ConnectionString
        {
            get
            {
                return (_owner?.ConnectionString);
            }
        }

        [CategoryAttribute("Mapping")]
        [Display(Name = "Datatype Mapping", Description = "")]
        public ObservableCollection<DataTypeMapping> DataTypeMapping
        {
            get
            {
                return (_owner?.DataTypeMapping);
            }
        }

        public DataSourceInfo(DataSource obj)
        {
            _owner = obj;
        }
    }



}
