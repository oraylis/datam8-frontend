using System.ComponentModel;

namespace Dm8PluginBase.BaseClasses
{
    public class DisplayObject<T> where T : class
    {
        public string Name { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string Schema { get; set; } = "";
        public string Type { get; set; } = "";
        public string Source { get; set; } = "";
        public T? Cargo { get; set; }
        public bool IsChecked
        {
            get
            {
                return (_isChecked);
            }
            set
            {
                _isChecked = value;
                OnCheckableChanged(new PropertyChangedEventArgs("IsChecked"));
            }
        }
        private bool _isChecked = false;
        protected virtual void OnCheckableChanged(PropertyChangedEventArgs args)
        {
            CheckableChanged?.Invoke(this, args);
        }
        public event PropertyChangedEventHandler? CheckableChanged;
    }
}
