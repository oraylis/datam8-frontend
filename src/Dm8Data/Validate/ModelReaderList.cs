/* DataM8
 * Copyright (C) 2024-2025 ORAYLIS GmbH
 *
 * This file is part of DataM8.
 *
 * DataM8 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DataM8 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

using Dm8Data.Helper;
using Newtonsoft.Json;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dm8Data.Generic;
using Dm8Data.Properties;
using Dm8Data.Validate.Exceptions;
using Dm8Data.Validate.Generic;
using Dm8Data.Validate.Base;

namespace Dm8Data.Validate
{
    public class ModelReaderList<TObj, TObjList> : IModelReaderList<TObj>
        where TObj : class, new()
        where TObjList : IModelEntryList<TObj>, new()
    {
        public virtual Task<IEnumerable<ModelReaderException>> ValidateAsync(SolutionHelper solutionHelper, IEnumerable<TObj> list)
        {
            throw new NotImplementedException();
        }


        public virtual async Task<IEnumerable<TObj>> ReadFromFileAsync(string fileName)
        {
            if (fileName == null) throw new ArgumentNullException(nameof(fileName));
            string json = await FileHelper.ReadFileAsync(fileName);
            return await ((IModelReaderList<TObj>) this).ReadFromStringAsync(json);
        }


        public virtual async Task<IEnumerable<TObj>> ReadFromStringAsync(string json)
        {
            IEnumerable<TObj> items = null;
            await Task.Run(() =>
            {
                try
                {
                    var objectList = JsonConvert.DeserializeObject<TObjList>(json);
                    // validate if JSON is valid
                    if (objectList != null)
                        items = objectList.Values.ToList();
                }
                catch (Exception)
                {
                    throw;
                }
            });
            if (items == null)
                throw new NullReferenceException(string.Format(Resources.ModelReaderList_ReadFromStringAsync_Cannot_deserialize_json__0_, json));
            return items;
        }


        async Task<IEnumerable> IModelReaderList.ReadFromFileAsync(string fileName) => await this.ReadFromFileAsync(fileName);

        async Task<object> IModelReader.ReadFromFileAsync(string fileName) => await this.ReadFromFileAsync(fileName);


        async Task<IEnumerable> IModelReaderList.ReadFromStringAsync(string json) => await this.ReadFromStringAsync(json);

        async Task<object> IModelReader.ReadFromStringAsync(string json) => await this.ReadFromStringAsync(json);

        async Task<IEnumerable<ModelReaderException>> IModelReaderList.ValidateAsync(SolutionHelper solutionHelper, IEnumerable list) => await this.ValidateAsync(solutionHelper, list as IEnumerable<TObj>);

        async Task<IEnumerable<ModelReaderException>> IModelReader.ValidateObjectAsync(SolutionHelper solutionHelper, object o) => await this.ValidateAsync(solutionHelper, o as IEnumerable<TObj>);
    }
}
