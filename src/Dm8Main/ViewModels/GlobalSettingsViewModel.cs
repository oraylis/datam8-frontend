using System.Composition;
using System.Threading.Tasks;
using Dm8Main.Services;

namespace Dm8Main.ViewModels
{
   [Export]
   public class GlobalSettingsViewModel:AnchorViewModel
   {
      #region Property GlobalSettings
      public ISolutionService GlobalSettings
      {
         get => this.globalSettings;
         set => this.SetProperty(ref this.globalSettings, value);
      }

      public ISolutionService globalSettings;
      #endregion

      public GlobalSettingsViewModel(ISolutionService solutionService)
      {
         this.Title = "Global Settings";
         this.GlobalSettings = solutionService;
      }

#pragma warning disable CS1998 // Async method lacks 'await' operators and will run synchronously
      public override async Task SaveAsync()
      {
         await this.GlobalSettings.SaveAsync();
      }

   }
}
