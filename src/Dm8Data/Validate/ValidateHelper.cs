using System;
using System.Linq.Expressions;
using System.Reflection;

namespace Dm8Data.Validate
{
    public class ValidateHelper
    {

        public static string GetPropertyName(Expression property)
        {
            LambdaExpression lambda = (LambdaExpression)property;
            MemberExpression memberExpression;

            if (lambda.Body is UnaryExpression unaryExpression)
            {
                memberExpression = (MemberExpression)(unaryExpression.Operand);
            }
            else
            {
                memberExpression = (MemberExpression)(lambda.Body);
            }

            return ((PropertyInfo)memberExpression.Member).Name;
        }

        public static Tuple<string,string> GetReferenceNames(Expression property)
        {
            LambdaExpression lambda = (LambdaExpression)property;

            if (lambda.Body is NewExpression newExpression)
            {
                string item1 = newExpression.Arguments.Count > 0 ? GetReferencePropertyName(newExpression.Arguments[0]) : null;
                string item2 = newExpression.Arguments.Count > 1 ? GetReferencePropertyName(newExpression.Arguments[1]) : null;
                return new Tuple<string, string>(item1, item2);
            }

            return new Tuple<string, string>("#", "#"); ;
        }

        private static string GetReferencePropertyName(Expression expression)
        {
            if (expression is MemberExpression memberExpression)
            {
                return memberExpression.Member.Name;
            }
            return "#";
        }
    }
}