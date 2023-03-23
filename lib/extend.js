/**
 * Deep clone an object.
 * Be careful, if define Object.prototype.clone here (which should be better), it will conflict with mongoose lib. Not investigated yet!
 */
Object.clone = function (source) {
    // Handle null or undefined or function
    if (!source || ("object" != typeof source) || (Object.keys(source).length <= 0))
        return source;

    // Handle the 3 simple types, Number and String and Boolean
    if (source instanceof Number || source instanceof String || source instanceof Boolean)
        return source.valueOf();

    // Handle Date
    if (source instanceof Date) {
        var copy = new Date();
        copy.setTime(source.getTime());
        return copy;
    }
    // Handle Array or Object
    if (Array.isArray(source)) {
        const copy = [];
        for (let i = 0; i < source.length; i += 1) {
            const attr = source[i];

            copy[i] = attr ? Object.clone(attr) : attr;
        }

        return copy;
    } else if (typeof source === 'object') {
        const copy = {};
        Object.keys(source).forEach(attr => {
            if (source.hasOwnProperty(attr) && !attr.startsWith('_') && !attr.startsWith('$'))
                copy[attr] = source[attr] ? Object.clone(source[attr]) : source[attr];
        })

        return copy;
    }

    // not support other types yet!
    throw new Error(`${typeof source} is not supported!`);
}


/**
 * Merge (deep) multiple objects into the target object.
 */
Object.merge = (target, ...source) => {
    const mg = (t, s) => {
        s = s || {};

        if(typeof t !== typeof s) return s;

        // not an object or is a regexp, assign source to target directly
        if (typeof t !== 'object' || typeof s !== 'object' || Object.prototype.toString.call(s) === '[object RegExp]') {
            t = s;
            return s;
        }

        Object.keys(s).forEach(k => {
            const sv = s[k];
            if (!Array.isArray(sv) && typeof sv === "object") {
                // Normal object, recursive merge
                t[k] = t[k] || {};
                t[k] = mg(t[k], sv);
            } else if (Array.isArray(sv)) {
                // Array, merge
                if (!Array.isArray(t[k])) {
                    t[k] = sv;
                } else {
                    let i = 0;
                    let list = [];
                    for (i = 0; i < sv.length; i += 1) {
                        t[k][i] = t[k][i] || {};
                        list[i] = mg(t[k][i], sv[i]);
                    }

                    t[k] = list;
                }
            } else {
                t[k] = sv;
            }
        });

        return t;
    };

    target = target || {};
    for (let i = 0; i < source.length; i += 1) {
        target = mg(target, source[i]);
    }

    return target;
};

// TODO: need to be corrected!!!
Object.intersection = (target, ...source) => {
    const inter = (t, s) => {
        s = s || {};

        // not an object or is a regexp, assign source to target directly
        if (typeof t !== 'object' || typeof s !== 'object' || Object.prototype.toString.call(s) === '[object RegExp]') {
            t = s;
            return s;
        }

        Object.keys(s).forEach(k => {
            const sv = s[k];
            if (!Array.isArray(sv) && typeof sv === "object") {
                // Normal object, recursive intersection
                t[k] = t[k] || {};
                t[k] = inter(t[k], sv);
            } else if (Array.isArray(sv)) {
                // Array, merge
                if (!Array.isArray(t[k])) {
                    t[k] = sv;
                } else {
                    let i = 0;
                    let list = [];
                    for (i = 0; i < sv.length; i += 1) {
                        t[k][i] = t[k][i] || {};
                        list[i] = inter(t[k][i], sv[i]);
                    }

                    t[k] = list;
                }
            } else {
                t[k] = sv;
            }
        });

        return t;
    };

    target = target || {};
    for (let i = 0; i < source.length; i += 1) {
        target = inter(target, source[i]);
    }

    return target;
};

Object.hasValue = (o) => {
    if ([undefined, null].indexOf(o) >= 0) return false;

    if (typeof o !== 'object' && !!o) return true;

    if (typeof o === 'object') {
        for (let j = 0; j < Object.keys(o).length; j += 1) {
            if (Object.hasValue(o[Object.keys(o)[j]])) return true;
        }
    }

    return false;
};

Object.nestValue = (obj, p) => {
    if (!obj || !p) return undefined;

    if (p === '.') return obj;

    let v = obj;
    const pList = p.split('.');

    for (let i = 0; i < pList.length; i += 1) {
        const pl = pList[i];

        if (v[pl]) v = v[pl];
        else { return undefined; }
    }

    return v;
};

Object.setValue = (obj, n, v) => {
    if (!obj || !n) return undefined;

    let t = obj;
    const nList = n.split('.');
    for (let i = 0; i < nList.length; i += 1) {
        const nl = nList[i];

        if (i < nList.length - 1) {
            if (!t[nl]) {
                t[nl] = typeof nList[i + 1] === 'number' ? [] : {};
            }
            t = t[nl];
        } else {
            t[nl] = v;
        }
    }

    return obj;
};

RegExp.quote = (str, attrs) => new RegExp(str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1"), attrs || '');